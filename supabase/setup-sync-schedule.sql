-- Run in hosted Supabase SQL Editor AFTER both migrations and worker deployment.
-- First enable Supabase Cron (pg_cron) and pg_net in the Dashboard.
-- In Vault create these secrets using the Dashboard (do not commit real values):
--   synthex_project_url: https://YOUR_PROJECT_REF.supabase.co
--   synthex_sync_worker_secret: same value as Edge secret SYNC_WORKER_SECRET
-- The secret is resolved at runtime rather than embedded in the cron definition.
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name = 'synthex_project_url')
     or not exists(select 1 from vault.decrypted_secrets where name = 'synthex_sync_worker_secret') then
    raise exception 'Configure both SYNTHEX Vault secrets before scheduling';
  end if;
end $$;
select cron.schedule('synthex-sync-sheets', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'synthex_project_url') || '/functions/v1/sync-sheets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'synthex_sync_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 100000
  );
$job$);
