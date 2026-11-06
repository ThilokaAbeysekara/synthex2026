import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { synchronizeSubmission, deliverSheetJob } from '../supabase/functions/_shared/sheets-sync.mjs';
import { createSyncWorker } from '../supabase/functions/sync-sheets/handler.mjs';

const sheets = { url: 'https://script.google.com/macros/s/test/exec', secret: 'server-only-secret' };
const submission = { id: 'SYNTHEX-11111111-1111-4111-8111-111111111111', topic: '=HYPERLINK("bad")',
  email: 'test@example.com', phone: '+94712345678', batch: '24/25', submissionType: 'individual',
  filePath: 'private/paper.docx', members: [{ regNo: 'REG001', fullName: 'Test Lead' }] };
const job = { submission, leaseToken: crypto.randomUUID() };

test('successful server-to-server delivery confirms the matching reference ID', async () => {
  let completion;
  const client = { rpc: async (name, args) => { completion = { name, args }; return { data: true }; } };
  const result = await deliverSheetJob(client, job, { ...sheets, fetchImpl: async (url, options) => {
    assert.equal(url, sheets.url);
    assert.equal(JSON.parse(options.body).secret, sheets.secret);
    assert.equal(JSON.parse(options.body).submission.id, submission.id);
    return Response.json({ success: true, id: submission.id });
  } });
  assert.equal(result, 'synced');
  assert.equal(completion.name, 'complete_sheet_sync');
  assert.equal(completion.args.p_success, true);
});
for (const failure of ['network', 'html', 'denied', 'wrong-id']) {
  test(`Sheets ${failure} failure leaves the saved registration pending`, async () => {
    let success;
    const client = { rpc: async (_, args) => { success = args.p_success; return { data: true }; } };
    const result = await deliverSheetJob(client, job, { ...sheets, fetchImpl: async () => {
      if (failure === 'network') throw new Error('Offline');
      if (failure === 'html') return new Response('<html>Sign in</html>');
      return Response.json({ success: failure !== 'denied', id: 'wrong-id' });
    } });
    assert.equal(result, 'pending'); assert.equal(success, false);
  });
}
test('missing bridge config never blocks registration and does not claim a job', async () => {
  assert.equal(await synchronizeSubmission({ rpc() { throw new Error('Should not be called'); } }, submission.id), 'pending');
});
test('already synchronized retry does not send another webhook', async () => {
  const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { status: 'synced' } }) };
  const client = { rpc: async () => ({ data: null }), from: () => query };
  assert.equal(await synchronizeSubmission(client, submission.id, { ...sheets, fetchImpl() { throw new Error('Must not send'); } }), 'synced');
});
test('retry worker rejects public requests without its server secret', async () => {
  const handler = createSyncWorker({ client: {}, workerSecret: 'worker-secret', sheets });
  assert.equal((await handler(new Request('https://test', { method: 'POST' }))).status, 403);
});
test('authorized retry worker drains pending work', async () => {
  let claims = 0;
  const client = { rpc: async name => name === 'claim_sheet_sync' ? { data: claims++ === 0 ? job : null } : { data: true } };
  const handler = createSyncWorker({ client, workerSecret: 'worker-secret',
    sheets: { ...sheets, fetchImpl: async () => Response.json({ success: true, id: submission.id }) } });
  const response = await handler(new Request('https://test', { method: 'POST', headers: { 'x-sync-worker-secret': 'worker-secret' } }));
  assert.deepEqual(await response.json(), { processed: 1, synced: 1 });
});

const script = await readFile(new URL('../google-apps-script.js', import.meta.url), 'utf8');
function bridge() {
  const rows = []; let locked = false;
  const range = { setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; },
    createTextFinder(id) { return { matchEntireCell() { return this; }, findNext: () => rows.some(row => row[1] === id) }; } };
  const sheet = { getLastRow: () => rows.length, appendRow: row => rows.push(row), getRange: () => range, setFrozenRows() {} };
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => ({ SHEETS_SYNC_SECRET: sheets.secret, SPREADSHEET_ID: 'existing-sheet' }[name]) }) },
    LockService: { getScriptLock: () => ({ tryLock() { assert.equal(locked, false); locked = true; return true; }, releaseLock() { locked = false; } }) },
    SpreadsheetApp: { openById: () => ({ getSheets: () => [sheet] }), flush() {} },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_, text) => [...createHash('sha256').update(text).digest()] },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) }
  };
  vm.runInNewContext(script, context);
  return { context, rows, post: payload => context.doPost({ postData: { contents: JSON.stringify(payload) } }) };
}
test('Apps Script verifies the secret, deduplicates by reference and protects formulas', () => {
  const { post, rows, context } = bridge();
  assert.equal(post({ secret: 'wrong', submission }).success, false);
  assert.equal(rows.length, 0);
  assert.equal(post({ secret: sheets.secret, submission }).success, true);
  assert.equal(rows.length, 2);
  assert.ok(rows[1][6].startsWith("'="));
  assert.ok(rows[1][9].startsWith("'+"));
  assert.equal(post({ secret: sheets.secret, submission }).duplicate, true);
  assert.equal(rows.length, 2);
  assert.equal(context.doGet().success, false);
});
