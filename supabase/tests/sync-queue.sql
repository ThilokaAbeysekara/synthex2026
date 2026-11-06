-- Run after both migrations, in an isolated test project. Fixtures roll back.
begin;
insert into storage.objects(bucket_id, name, metadata) values
  ('concept-papers','queue-test/paper.docx','{"size":10485760,"mimetype":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}');
do $$
declare v_id text; v_job jsonb; v_next jsonb;
begin
  v_id := public.finalize_research_submission(gen_random_uuid(),
    '{"submissionType":"group","batch":"24/25","topic":"Queue test","email":"queue@example.invalid","phone":"","members":[{"regNo":"QUEUE/001","fullName":"First"},{"regNo":"QUEUE/002","fullName":"Second"}]}',
    'queue-test/paper.docx','paper.docx',10485760);
  if not exists(select 1 from public.sheet_sync_jobs where submission_id = v_id and status = 'pending') then raise exception 'Registration was not enqueued atomically'; end if;
  if (select file_type from public.synthex_submissions where id = v_id) <> 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then raise exception 'Wrong MIME type'; end if;
  v_job := public.claim_sheet_sync(v_id);
  if v_job->'submission'->>'id' <> v_id or jsonb_array_length(v_job->'submission'->'members') <> 2 then raise exception 'Queue payload incomplete'; end if;
  if public.claim_sheet_sync(v_id) is not null then raise exception 'Active lease claimed twice'; end if;
  if public.complete_sheet_sync(v_id, gen_random_uuid(), true) then raise exception 'Wrong lease completed job'; end if;
  if not public.complete_sheet_sync(v_id, (v_job->>'leaseToken')::uuid, false) then raise exception 'Failure not recorded'; end if;
  if public.claim_sheet_sync(v_id) is not null then raise exception 'Backoff not enforced'; end if;
  update public.sheet_sync_jobs set available_at = now() - interval '1 minute' where submission_id = v_id;
  v_next := public.claim_sheet_sync(v_id);
  if public.complete_sheet_sync(v_id, (v_job->>'leaseToken')::uuid, true) then raise exception 'Stale lease completed job'; end if;
  update public.sheet_sync_jobs set locked_until = now() - interval '1 minute' where submission_id = v_id;
  v_job := public.claim_sheet_sync(v_id);
  if v_job is null then raise exception 'Expired lease not recovered'; end if;
  if public.complete_sheet_sync(v_id, (v_next->>'leaseToken')::uuid, true) then raise exception 'Expired worker completed job'; end if;
  if not public.complete_sheet_sync(v_id, (v_job->>'leaseToken')::uuid, true) then raise exception 'Success not recorded'; end if;
  if public.claim_sheet_sync(v_id) is not null then raise exception 'Synced job was reclaimed'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform 1 from public.sheet_sync_jobs;
    raise exception 'Anonymous user can read queue';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_sheet_sync(null);
    raise exception 'Anonymous user can claim queue';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
