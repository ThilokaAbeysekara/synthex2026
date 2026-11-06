-- Run AFTER the migration, in an isolated Supabase test project's SQL editor.
-- All fixtures and changes are rolled back. No real Storage file is uploaded.
begin;
insert into auth.users(id, email) values
  ('11111111-1111-4111-8111-111111111111', 'portal-admin-test@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'portal-user-test@example.invalid');
insert into public.portal_admins values ('11111111-1111-4111-8111-111111111111');
insert into storage.objects(bucket_id, name, metadata) values
  ('concept-papers', 'rls-test/paper.pdf', '{"size":60,"mimetype":"application/pdf"}'),
  ('concept-papers', 'rls-test/duplicate.pdf', '{"size":60,"mimetype":"application/pdf"}');

do $$
declare v_id text;
  v_payload jsonb := '{"submissionType":"individual","batch":"24/25","topic":"RLS test","email":"rls-test@example.invalid","phone":"","members":[{"regNo":"RLS/001","fullName":"Test Participant"}]}';
begin
  v_id := public.finalize_research_submission('33333333-3333-4333-8333-333333333333', v_payload, 'rls-test/paper.pdf', 'paper.pdf', 60);
  if v_id is null then raise exception 'Missing submission ID'; end if;
  if v_id <> public.finalize_research_submission('33333333-3333-4333-8333-333333333333', v_payload, 'rls-test/paper.pdf', 'paper.pdf', 60) then
    raise exception 'Retry did not return the same ID';
  end if;
  begin
    perform public.finalize_research_submission('44444444-4444-4444-8444-444444444444', v_payload, 'rls-test/duplicate.pdf', 'paper.pdf', 60);
    raise exception 'Duplicate was accepted';
  exception when unique_violation then null;
  end;
  -- A different email must still fail on the participant's registration number;
  -- the failed transaction must roll back its parent submission as well.
  begin
    perform public.finalize_research_submission('55555555-5555-4555-8555-555555555555',
      jsonb_set(v_payload, '{email}', '"another-test@example.invalid"'), 'rls-test/duplicate.pdf', 'paper.pdf', 60);
    raise exception 'Duplicate participant was accepted';
  exception when unique_violation then null;
  end;
  if exists(select 1 from public.research_submissions where request_token in
    ('44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555')) then
    raise exception 'Incomplete submission survived a failed transaction';
  end if;
end $$;

set local role anon;
do $$ begin
  begin
    perform 1 from public.research_submissions;
    raise exception 'Anonymous SELECT was allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.finalize_research_submission(gen_random_uuid(), '{}'::jsonb, 'bad', 'bad.pdf', 60);
    raise exception 'Anonymous RPC was allowed';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from storage.objects where bucket_id = 'concept-papers') then
    raise exception 'Anonymous Storage SELECT was allowed';
  end if;
  begin
    insert into storage.objects(bucket_id, name) values ('concept-papers', 'rls-test/anonymous.pdf');
    raise exception 'Anonymous Storage INSERT was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ begin
  if public.is_portal_admin() then raise exception 'Non-organizer has admin membership'; end if;
  if exists(select 1 from public.research_submissions) then raise exception 'Non-organizer can read submissions'; end if;
  if exists(select 1 from storage.objects where bucket_id = 'concept-papers') then raise exception 'Non-organizer can read PDFs'; end if;
  begin
    insert into public.portal_admins values ('22222222-2222-4222-8222-222222222222');
    raise exception 'Self-promotion allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$ begin
  if not public.is_portal_admin() then raise exception 'Organizer denied'; end if;
  if not exists(select 1 from public.research_submissions where email = 'rls-test@example.invalid') then raise exception 'Organizer cannot read submission'; end if;
  if not exists(select 1 from public.submission_participants where reg_no = 'RLS/001') then raise exception 'Organizer cannot read participant'; end if;
  if not exists(select 1 from storage.objects where bucket_id = 'concept-papers' and name = 'rls-test/paper.pdf') then raise exception 'Organizer cannot read committed PDF'; end if;
  if exists(select 1 from storage.objects where bucket_id = 'concept-papers' and name = 'rls-test/duplicate.pdf') then raise exception 'Uncommitted PDF visible'; end if;
  begin
    insert into storage.objects(bucket_id, name) values ('concept-papers', 'rls-test/organizer.pdf');
    raise exception 'Organizer Storage INSERT was allowed';
  exception when insufficient_privilege then null; end;
  update storage.objects set name = 'rls-test/changed.pdf'
    where bucket_id = 'concept-papers' and name = 'rls-test/paper.pdf';
  if found then raise exception 'Organizer Storage UPDATE was allowed'; end if;
  delete from storage.objects where bucket_id = 'concept-papers' and name = 'rls-test/paper.pdf';
  if found then raise exception 'Organizer Storage DELETE was allowed'; end if;
end $$;
reset role;
rollback;
