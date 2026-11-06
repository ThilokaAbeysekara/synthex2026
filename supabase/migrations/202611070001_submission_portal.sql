-- New names avoid silently reusing an incompatible legacy submissions table.
begin;
create table public.portal_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.portal_admins enable row level security;
revoke all on public.portal_admins from anon, authenticated;
grant select on public.portal_admins to authenticated;
create policy "Organizers can verify their membership" on public.portal_admins
  for select to authenticated using (user_id = (select auth.uid()));

create function public.is_portal_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.portal_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_portal_admin() from public, anon;
grant execute on function public.is_portal_admin() to anon, authenticated;

create table public.portal_settings (
  singleton boolean primary key default true check(singleton),
  submissions_open boolean not null default true
);
insert into public.portal_settings default values;
alter table public.portal_settings enable row level security;
revoke all on public.portal_settings from anon, authenticated;

create table public.research_submissions (
  id text primary key default ('SYNTHEX-' || upper(gen_random_uuid()::text)),
  request_token uuid not null unique,
  created_at timestamptz not null default now(),
  submission_type text not null check(submission_type in ('individual', 'group')),
  batch text not null check(batch in ('24/25', '23/24', '22/23', '21/22', '20/21')),
  topic text not null check(length(btrim(topic)) between 1 and 300),
  email text not null unique check(email = lower(btrim(email)) and length(email) between 3 and 254),
  phone text not null default '' check(length(phone) <= 30),
  file_path text not null unique,
  file_name text not null check(length(file_name) between 1 and 200),
  file_size integer not null check(file_size between 8 and 5242880)
);
create table public.submission_participants (
  submission_id text not null references public.research_submissions(id) on delete cascade,
  position integer not null check(position between 1 and 6),
  reg_no text not null unique check(reg_no ~ '^[A-Z0-9][A-Z0-9/._-]{1,49}$'),
  full_name text not null check(length(btrim(full_name)) between 1 and 150),
  primary key(submission_id, position)
);
create index on public.research_submissions(created_at desc);
alter table public.research_submissions enable row level security;
alter table public.submission_participants enable row level security;
revoke all on public.research_submissions, public.submission_participants from anon, authenticated;
grant select on public.research_submissions, public.submission_participants to authenticated;
create policy "Organizers read submissions" on public.research_submissions
  for select to authenticated using ((select public.is_portal_admin()));
create policy "Organizers read participants" on public.submission_participants
  for select to authenticated using ((select public.is_portal_admin()));

create function public.can_read_concept_paper(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_portal_admin() and exists (
    select 1 from public.research_submissions where file_path = p_path);
$$;
revoke all on function public.can_read_concept_paper(text) from public;
grant execute on function public.can_read_concept_paper(text) to anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('concept-papers', 'concept-papers', false, 5242880, array['application/pdf'])
on conflict(id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf'];
-- Defense in depth: these restrictive policies also constrain any pre-existing
-- broad permissive policies on storage.objects in this project.
create policy "Private papers access guard" on storage.objects as restrictive
  for select to public using (bucket_id <> 'concept-papers' or
    public.can_read_concept_paper(name));
create policy "Organizers download committed papers" on storage.objects
  for select to authenticated using (bucket_id = 'concept-papers' and
    public.can_read_concept_paper(name));
create policy "Private papers insert guard" on storage.objects as restrictive
  for insert to public with check (bucket_id <> 'concept-papers');
create policy "Private papers update guard" on storage.objects as restrictive
  for update to public using (bucket_id <> 'concept-papers') with check (bucket_id <> 'concept-papers');
create policy "Private papers delete guard" on storage.objects as restrictive
  for delete to public using (bucket_id <> 'concept-papers');

-- Upload first, then commit submission + all participant claims atomically.
-- Only the Edge Function's service role can call this function.
create function public.finalize_research_submission(
  p_token uuid, p_payload jsonb, p_path text, p_filename text, p_size integer
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_id text;
  v_member jsonb;
  v_position integer := 0;
  v_count integer;
begin
  -- Serialize retries of the same token, including simultaneous uploads.
  perform pg_advisory_xact_lock(hashtextextended(p_token::text, 0));
  select id into v_id from public.research_submissions where request_token = p_token;
  if found then return v_id; end if;
  if not (select submissions_open from public.portal_settings where singleton) then
    raise exception 'Submissions are closed' using errcode = 'P0001';
  end if;
  v_count := jsonb_array_length(p_payload->'members');
  if (p_payload->>'submissionType' = 'individual' and v_count <> 1) or
     (p_payload->>'submissionType' = 'group' and v_count not between 2 and 6) then
    raise exception 'Invalid participant count';
  end if;
  if not exists(select 1 from storage.objects where bucket_id = 'concept-papers'
    and name = p_path and (metadata->>'size')::bigint = p_size
    and metadata->>'mimetype' = 'application/pdf') then
    raise exception 'Uploaded paper not found';
  end if;
  insert into public.research_submissions(request_token, submission_type, batch, topic,
    email, phone, file_path, file_name, file_size)
  values(p_token, p_payload->>'submissionType', p_payload->>'batch', p_payload->>'topic',
    p_payload->>'email', p_payload->>'phone', p_path, p_filename, p_size) returning id into v_id;
  for v_member in select value from jsonb_array_elements(p_payload->'members') loop
    v_position := v_position + 1;
    insert into public.submission_participants(submission_id, position, reg_no, full_name)
    values(v_id, v_position, v_member->>'regNo', v_member->>'fullName');
  end loop;
  return v_id;
end;
$$;
revoke all on function public.finalize_research_submission(uuid,jsonb,text,text,integer) from public, anon, authenticated;
grant execute on function public.finalize_research_submission(uuid,jsonb,text,text,integer) to service_role;

-- Atomic, server-side request budget. No IP addresses are stored, only hashes.
create table public.portal_request_limits (
  key text primary key,
  window_start timestamptz not null,
  requests integer not null
);
alter table public.portal_request_limits enable row level security;
revoke all on public.portal_request_limits from anon, authenticated;
grant all on public.portal_admins, public.portal_settings, public.research_submissions,
  public.submission_participants, public.portal_request_limits to service_role;
create function public.claim_portal_request(p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_requests integer;
begin
  delete from public.portal_request_limits where window_start < now() - interval '1 day';
  insert into public.portal_request_limits as limits(key, window_start, requests)
  values(p_key, now(), 1)
  on conflict(key) do update set
    requests = case when limits.window_start < now() - interval '15 minutes' then 1 else limits.requests + 1 end,
    window_start = case when limits.window_start < now() - interval '15 minutes' then now() else limits.window_start end
  returning requests into v_requests;
  return v_requests <= 20;
end;
$$;
revoke all on function public.claim_portal_request(text) from public, anon, authenticated;
grant execute on function public.claim_portal_request(text) to service_role;
commit;
