import { deliverSheetJob } from '../_shared/sheets-sync.mjs';

export function createSyncWorker({ client, workerSecret, sheets }) {
  return async req => {
    const reply = (code, body) => Response.json(body, { status: code, headers: { 'Cache-Control': 'no-store' } });
    if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
    if (!client || !workerSecret || !sheets?.secret || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(sheets?.url || '')) return reply(503, { error: 'Worker not configured.' });
    const provided = req.headers.get('x-sync-worker-secret') || '';
    const hash = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    const [expected, actual] = await Promise.all([hash(workerSecret), hash(provided)]);
    let diff = 0;
    new Uint8Array(expected).forEach((value, i) => { diff |= value ^ new Uint8Array(actual)[i]; });
    if (diff) return reply(403, { error: 'Forbidden.' });
    let processed = 0, synced = 0;
    // Sequential, bounded batch: at most 10 x 8s webhook attempts per invocation.
    for (let i = 0; i < 10; i++) {
      const claimed = await client.rpc('claim_sheet_sync', { p_submission_id: null });
      if (claimed.error) return reply(503, { error: 'Queue unavailable.', processed, synced });
      if (!claimed.data) break;
      processed++;
      if (await deliverSheetJob(client, claimed.data, sheets) === 'synced') synced++;
    }
    return reply(200, { processed, synced });
  };
}
