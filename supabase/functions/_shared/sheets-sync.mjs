export async function synchronizeSubmission(client, id, { url, secret, fetchImpl = fetch } = {}) {
  // A configuration or Sheets outage must never turn a saved registration into
  // a failed registration. The transactional outbox retains the pending work.
  if (!url || !secret || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) return 'pending';
  try {
    const claimed = await client.rpc('claim_sheet_sync', { p_submission_id: id });
    if (claimed.error) return 'pending';
    if (!claimed.data) {
      const current = await client.from('sheet_sync_jobs').select('status').eq('submission_id', id).maybeSingle();
      return !current.error && current.data?.status === 'synced' ? 'synced' : 'pending';
    }
    return await deliverSheetJob(client, claimed.data, { url, secret, fetchImpl });
  } catch { return 'pending'; }
}

export async function deliverSheetJob(client, job, { url, secret, fetchImpl = fetch }) {
  let delivered = false;
  try {
    const response = await fetchImpl(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, submission: job.submission }),
      redirect: 'follow', signal: AbortSignal.timeout(8000)
    });
    const result = await response.json();
    delivered = response.ok && result.success === true && result.id === job.submission.id;
  } catch { /* Leave the job pending for an idempotent retry. */ }
  try {
    const completion = await client.rpc('complete_sheet_sync', {
      p_id: job.submission.id, p_lease: job.leaseToken, p_success: delivered
    });
    return delivered && !completion.error && completion.data === true ? 'synced' : 'pending';
  } catch { return 'pending'; }
}
