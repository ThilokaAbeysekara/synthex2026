-- Upgrade the earlier portal without losing submissions, IDs, participant FKs or RLS.
begin;
do $$ begin
  if to_regclass('public.synthex_submissions') is null then
    alter table public.research_submissions rename to synthex_submissions;
  elsif to_regclass('public.research_submissions') is not null then
    raise exception 'Both submission tables exist. Reconcile them before this migration; no data has been changed.';
  end if;
end $$;
alter table public.synthex_submissions drop constraint research_submissions_file_size_check;
alter table public.synthex_submissions add constraint synthex_submissions_file_size_check check(file_size between 8 and 10485760);
alter table public.synthex_submissions add column file_type text not null default 'application/pdf'
  check(file_type in ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
update storage.buckets set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
where id = 'concept-papers';
create or replace function public.can_read_concept_paper(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_portal_admin() and exists (
    select 1 from public.synthex_submissions where file_path = p_path);
$$;

-- Durable queue: enqueue in the SAME transaction as the registration.
create table public.sheet_sync_jobs (
  submission_id text primary key references public.synthex_submissions(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sending','synced')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  lease_token uuid,
  synced_at timestamptz
);
alter table public.sheet_sync_jobs enable row level security;
revoke all on public.sheet_sync_jobs from public, anon, authenticated;
grant all on public.sheet_sync_jobs to service_role;
create index on public.sheet_sync_jobs(available_at) where status <> 'synced';
create function public.enqueue_sheet_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sheet_sync_jobs(submission_id) values(new.id);
  return new;
end;
$$;
revoke all on function public.enqueue_sheet_sync() from public, anon, authenticated;
create trigger enqueue_registration_sheet_sync after insert on public.synthex_submissions
for each row execute function public.enqueue_sheet_sync();
-- Existing confirmed records are synchronized as well.
insert into public.sheet_sync_jobs(submission_id) select id from public.synthex_submissions;

create or replace function public.finalize_research_submission(
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
  select id into v_id from public.synthex_submissions where request_token = p_token;
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
    and metadata->>'mimetype' in ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document')) then
    raise exception 'Uploaded paper not found';
  end if;
  insert into public.synthex_submissions(request_token, submission_type, batch, topic,
    email, phone, file_path, file_name, file_size, file_type)
  values(p_token, p_payload->>'submissionType', p_payload->>'batch', p_payload->>'topic',
    p_payload->>'email', p_payload->>'phone', p_path, p_filename, p_size, (select metadata->>'mimetype' from storage.objects where bucket_id = 'concept-papers' and name = p_path)) returning id into v_id;
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


-- Leasing prevents concurrent workers from processing the same job. An expired
-- lease can be recovered after a worker crash; the bridge deduplicates by ID.
create function public.claim_sheet_sync(p_submission_id text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_job public.sheet_sync_jobs; v_submission jsonb;
begin
  select * into v_job from public.sheet_sync_jobs j
  where (p_submission_id is null or j.submission_id = p_submission_id)
    and ((j.status = 'pending' and j.available_at <= now())
      or (j.status = 'sending' and j.locked_until < now()))
  order by j.available_at limit 1 for update skip locked;
  if not found then return null; end if;
  update public.sheet_sync_jobs set status = 'sending', attempts = attempts + 1,
    locked_until = now() + interval '2 minutes', lease_token = gen_random_uuid()
  where submission_id = v_job.submission_id returning * into v_job;
  select jsonb_build_object(
    'id', s.id, 'timestamp', s.created_at, 'submissionType', s.submission_type,
    'batch', s.batch, 'topic', s.topic, 'email', s.email, 'phone', s.phone,
    'filePath', s.file_path, 'fileName', s.file_name, 'fileType', s.file_type,
    'members', (select jsonb_agg(jsonb_build_object('regNo', p.reg_no, 'fullName', p.full_name) order by p.position)
      from public.submission_participants p where p.submission_id = s.id)
  ) into v_submission from public.synthex_submissions s where s.id = v_job.submission_id;
  return jsonb_build_object('leaseToken', v_job.lease_token, 'submission', v_submission);
end;
$$;
create function public.complete_sheet_sync(p_id text, p_lease uuid, p_success boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.sheet_sync_jobs set
    status = case when p_success then 'synced' else 'pending' end,
    synced_at = case when p_success then now() else null end,
    available_at = now() + make_interval(secs => least(3600, 30 * power(2, least(attempts, 6)))::integer),
    locked_until = null, lease_token = null
  where submission_id = p_id and status = 'sending' and lease_token = p_lease;
  return found;
end;
$$;
revoke all on function public.claim_sheet_sync(text), public.complete_sheet_sync(text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.claim_sheet_sync(text), public.complete_sheet_sync(text,uuid,boolean) to service_role;
commit;
