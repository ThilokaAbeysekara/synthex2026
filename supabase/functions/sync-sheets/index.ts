import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { createSyncWorker } from './handler.mjs';
const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
Deno.serve(createSyncWorker({ client, workerSecret: Deno.env.get('SYNC_WORKER_SECRET'),
  sheets: { url: Deno.env.get('SHEETS_WEBHOOK_URL') || Deno.env.get('GOOGLE_SHEET_WEBHOOK_URL') || Deno.env.get('APPS_SCRIPT_URL'), secret: Deno.env.get('SHEETS_SYNC_SECRET') } }));
