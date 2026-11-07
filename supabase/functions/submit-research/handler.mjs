import { synchronizeSubmission } from '../_shared/sheets-sync.mjs';
import { MAX_FILE_SIZE, validateSubmission, validateConceptPaper } from '../../../submission-validation.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = MAX_FILE_SIZE + 64 * 1024;

async function boundedFormData(req) {
  if (!req.body || Number(req.headers.get('content-length')) > MAX_BODY) throw new Error('Request exceeds the 10 MB document limit.');
  if (!req.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Error('Expected a form with a concept paper attachment.');
  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new Error('Request exceeds the 10 MB document limit.'); }
    chunks.push(value);
  }
  return new Response(new Blob(chunks), { headers: { 'Content-Type': req.headers.get('content-type') } }).formData();
}

export function createSubmissionHandler({ client, origins, rateSalt, sheets = {} }) {
  return async req => {
    const origin = req.headers.get('origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'apikey, content-type', 'Access-Control-Max-Age': '600' };
    if (origin && origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !origins.includes(origin)) return reply(403, { error: 'This website is not authorized to submit.' });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!client || !origins.length || !rateSalt) return reply(503, { error: 'Submission service is not configured. Please contact the organizers.' });
    if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
    let token, file, payload, document;
    try {
      // Supabase's gateway supplies this header. Rate limiting is an additional
      // abuse control, not authorization; database uniqueness remains authoritative.
      const ip = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${rateSalt}:${ip}`));
      const rateKey = Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
      const rate = await client.rpc('claim_portal_request', { p_key: rateKey });
      if (rate.error) return reply(503, { error: 'Submission service is temporarily unavailable. Please try again.' });
      if (!rate.data) return reply(429, { error: 'Too many attempts. Please wait 15 minutes before trying again.' });
      const form = await boundedFormData(req);
      token = form.get('requestToken');
      if (typeof token !== 'string' || !UUID.test(token)) throw new Error('Invalid request token. Reload the page and try again.');
      const raw = form.get('payload');
      if (typeof raw !== 'string' || raw.length > 16000) throw new Error('Invalid submission details.');
      try { payload = validateSubmission(JSON.parse(raw)); }
      catch (error) { throw new Error(error instanceof SyntaxError ? 'Invalid submission details.' : error.message); }
      file = form.get('conceptPaper');
      document = await validateConceptPaper(file);
    } catch (error) {
      return reply(400, { error: error.message || 'Invalid submission.' });
    }
    try {
      const existing = await client.from('synthex_submissions').select('id').eq('request_token', token).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        const syncStatus = await synchronizeSubmission(client, existing.data.id, sheets);
        return reply(200, { success: true, id: existing.data.id, syncStatus });
      }
      const settings = await client.from('portal_settings').select('submissions_open').eq('singleton', true).single();
      if (settings.error) throw settings.error;
      if (!settings.data?.submissions_open) return reply(403, { error: 'Submissions are currently closed.' });

      // Every attempt owns a separate object. Concurrent retries cannot overwrite
      // or remove another attempt's successfully committed paper.
      const path = `${token}/${crypto.randomUUID()}.${document.extension}`;
      const upload = await client.storage.from('concept-papers').upload(path, file, {
        contentType: document.mimeType, upsert: false, cacheControl: '0'
      });
      if (upload.error) {
        // A network failure can occur after Storage accepted the object.
        await cleanup(client, path);
        return reply(502, { error: 'Document upload failed. Your submission has not been confirmed. Please retry.' });
      }
      const saved = await client.rpc('finalize_research_submission', {
        p_token: token, p_payload: payload, p_path: path, p_filename: file.name, p_size: file.size
      });
      // Resolve ambiguous RPC failures before removing anything: the database
      // might have committed even when its HTTP response was interrupted.
      const committed = await client.from('synthex_submissions').select('id,file_path').eq('request_token', token).maybeSingle();
      if (committed.error) {
        console.error('Submission outcome unknown; retain object for reconciliation', path);
        return reply(503, { error: 'Confirmation was interrupted. Keep this page open and retry the same form to recover your submission ID.' });
      }
      if (committed.data) {
        if (committed.data.file_path !== path) await cleanup(client, path);
        const syncStatus = await synchronizeSubmission(client, committed.data.id, sheets);
        return reply(200, { success: true, id: committed.data.id, syncStatus });
      }
      await cleanup(client, path);
      if (saved.error?.code === '23505') return reply(409, { error: 'A submission already exists for this contact email or one of these registration numbers. Contact the organizers for changes.' });
      if (saved.error?.code === 'P0001' && saved.error.message?.includes('closed')) return reply(403, { error: 'Submissions are currently closed.' });
      console.error('Submission commit failed', saved.error?.code || 'unknown');
      return reply(503, { error: 'The submission could not be recorded. Your form is unchanged; please try again.' });
    } catch {
      console.error('Submission backend request failed');
      return reply(503, { error: 'Submission service is temporarily unavailable. Keep this page open and retry the same form.' });
    }
  };
}

async function cleanup(client, path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await client.storage.from('concept-papers').remove([path]);
      if (!result.error) return;
    } catch { /* Retry transient Storage errors. */ }
  }
  // No submission row is created. This inaccessible orphan can be removed by
  // the documented maintenance script after the reconciliation grace period.
  console.error('Orphan document requires cleanup', path);
}
