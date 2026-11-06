import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { validateSubmission, validatePdf, MAX_PDF_SIZE } from '../submission-validation.mjs';
import { createSubmissionHandler } from '../supabase/functions/submit-research/handler.mjs';

const origin = 'https://synthex2026.live';
const valid = () => ({ submissionType: 'individual', batch: '23/24', topic: 'Research proposal',
  email: ' Student@Example.com ', phone: '', members: [{ regNo: ' 2021/ict/045 ', fullName: 'Test Student' }] });
const pdf = (size = 60) => new File(['%PDF-1.7\n', ' '.repeat(size - 9)], 'paper.pdf', { type: 'application/pdf' });
const token = () => crypto.randomUUID();

// Simulates the SDK boundary, including database transactions, concurrent unique
// constraints, lost responses, and storage failures. SQL policies are tested separately.
function backend(options = {}) {
  const state = { rows: [], objects: new Map(), uploads: 0, removals: 0, reads: 0 };
  const client = {
    from(table) {
      const query = { select() { return query; }, eq(column, value) { query.column = column; query.value = value; return query; },
        async maybeSingle() {
          state.reads++;
          if (options.reconcileError && state.reads > 1) return { error: { code: 'NETWORK' } };
          return { data: state.rows.find(row => row[query.column] === query.value) || null };
        },
        async single() { return { data: { submissions_open: !options.closed } }; }
      };
      return query;
    },
    async rpc(name, args) {
      if (name === 'claim_portal_request') return { data: !options.rateLimited, error: options.rateError ? {} : null };
      if (options.dbError) return { error: { code: options.dbError } };
      const existing = state.rows.find(row => row.request_token === args.p_token);
      if (existing) return { data: existing.id };
      if (state.rows.some(row => row.payload.email === args.p_payload.email || row.payload.members.some(m => args.p_payload.members.some(n => n.regNo === m.regNo)))) return { error: { code: '23505' } };
      assert.ok(state.objects.has(args.p_path), 'the file must exist before the transaction');
      const row = { id: `SYNTHEX-${crypto.randomUUID()}`, request_token: args.p_token, file_path: args.p_path, payload: args.p_payload };
      state.rows.push(row);
      return options.lostResponse ? { error: { message: 'network failure' } } : { data: row.id };
    },
    storage: { from() { return {
      async upload(path, file) {
        state.uploads++;
        if (options.uploadError) return { error: {} };
        state.objects.set(path, file);
        return {};
      },
      async remove(paths) { state.removals++; if (options.cleanupError) return { error: {} }; paths.forEach(path => state.objects.delete(path)); return {}; }
    }; } }
  };
  return { state, handler: createSubmissionHandler({ client, origins: [origin], rateSalt: 'test-salt' }) };
}

function request(payload = valid(), file = pdf(), requestToken = token(), requestOrigin = origin) {
  const body = new FormData();
  body.set('payload', JSON.stringify(payload));
  body.set('requestToken', requestToken);
  if (file) body.set('conceptPaper', file);
  return new Request('https://test.supabase.co/functions/v1/submit-research', {
    method: 'POST', headers: { Origin: requestOrigin, 'x-forwarded-for': '192.0.2.1' }, body
  });
}

test('normalizes contact email and registration number', () => {
  const data = validateSubmission(valid());
  assert.equal(data.email, 'student@example.com');
  assert.equal(data.members[0].regNo, '2021/ICT/045');
});

for (const [name, change] of [
  ['missing topic', p => p.topic = ' '], ['invalid email', p => p.email = 'bad'],
  ['invalid phone', p => p.phone = '<script>'], ['invalid batch', p => p.batch = 'unknown'],
  ['unknown submission type', p => p.submissionType = 'other'],
  ['missing name', p => p.members[0].fullName = ''], ['invalid registration', p => p.members[0].regNo = '<tag>'],
  ['duplicate group member', p => { p.submissionType = 'group'; p.members.push({ ...p.members[0] }); }],
  ['undersized group', p => p.submissionType = 'group'],
  ['oversized group', p => { p.submissionType = 'group'; p.members = Array.from({ length: 7 }, (_, i) => ({ regNo: `REG${i}`, fullName: 'Member' })); }],
  ['oversized topic', p => p.topic = 'x'.repeat(301)]
]) {
  test(`rejects ${name} on the server before upload`, async () => {
    const { state, handler } = backend();
    const input = valid(); change(input);
    assert.equal((await handler(request(input))).status, 400);
    assert.equal(state.uploads, 0);
    assert.equal(state.rows.length, 0);
  });
}

test('PDF boundary permits 5 MB and rejects 5 MB + 1 byte', async () => {
  await validatePdf(pdf(MAX_PDF_SIZE));
  await assert.rejects(validatePdf(pdf(MAX_PDF_SIZE + 1)), /5 MB/);
});
test('rejects renamed non-PDF, DOCX, empty file and missing attachment', async () => {
  for (const file of [new File(['not a PDF'], 'renamed.pdf', { type: 'application/pdf' }), new File(['%PDF-1.7'], 'paper.docx'), pdf(9).slice(0, 0), null]) {
    await assert.rejects(validatePdf(file));
  }
});
test('individual success has one committed row and one private object', async () => {
  const { state, handler } = backend();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.match((await response.json()).id, /^SYNTHEX-/);
  assert.equal(state.rows.length, 1);
  assert.equal(state.objects.size, 1);
});
test('group submission retains all members', async () => {
  const { state, handler } = backend();
  const payload = valid(); payload.submissionType = 'group';
  payload.members.push({ regNo: '2021/ICT/046', fullName: 'Second Member' });
  assert.equal((await handler(request(payload))).status, 200);
  assert.equal(state.rows[0].payload.members.length, 2);
});
test('upload failure never records a submission or reports success', async () => {
  const { state, handler } = backend({ uploadError: true });
  assert.equal((await handler(request())).status, 502);
  assert.equal(state.rows.length, 0);
});
test('database error removes uploaded PDF and never reports success', async () => {
  const { state, handler } = backend({ dbError: 'XX000' });
  assert.equal((await handler(request())).status, 503);
  assert.equal(state.objects.size, 0);
  assert.equal(state.rows.length, 0);
});
test('duplicate email removes only the rejected attempt PDF', async () => {
  const { state, handler } = backend();
  await handler(request());
  assert.equal((await handler(request())).status, 409);
  assert.equal(state.objects.size, 1);
  assert.equal(state.rows.length, 1);
});
test('same registration with different email is also rejected', async () => {
  const { state, handler } = backend();
  await handler(request());
  const payload = valid(); payload.email = 'other@example.com';
  assert.equal((await handler(request(payload))).status, 409);
  assert.equal(state.rows.length, 1);
});
test('idempotent retry recovers the same ID without another upload', async () => {
  const { state, handler } = backend(); const key = token();
  const first = await (await handler(request(valid(), pdf(), key))).json();
  const second = await (await handler(request(valid(), pdf(), key))).json();
  assert.equal(first.id, second.id);
  assert.equal(state.uploads, 1);
});
test('concurrent retries preserve a single row and its PDF', async () => {
  const { state, handler } = backend(); const key = token();
  const responses = await Promise.all([handler(request(valid(), pdf(), key)), handler(request(valid(), pdf(), key))]);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(state.rows.length, 1);
  assert.equal(state.objects.size, 1);
  assert.ok(state.objects.has(state.rows[0].file_path));
});
test('lost RPC response recovers committed row and retains its file', async () => {
  const { state, handler } = backend({ lostResponse: true });
  assert.equal((await handler(request())).status, 200);
  assert.ok(state.objects.has(state.rows[0].file_path));
});
test('ambiguous commit outcome keeps the file and asks for a safe retry', async () => {
  const { state, handler } = backend({ reconcileError: true });
  assert.equal((await handler(request())).status, 503);
  assert.equal(state.objects.size, 1);
  assert.equal(state.removals, 0);
});
test('failed cleanup retries, creates no incomplete row, and reports failure', async () => {
  const { state, handler } = backend({ dbError: 'XX000', cleanupError: true });
  assert.equal((await handler(request())).status, 503);
  assert.equal(state.rows.length, 0);
  assert.equal(state.removals, 3);
});
test('closed submissions and rate limits prevent uploads', async () => {
  for (const [options, code] of [[{ closed: true }, 403], [{ rateLimited: true }, 429], [{ rateError: true }, 503]]) {
    const { state, handler } = backend(options);
    assert.equal((await handler(request())).status, code);
    assert.equal(state.uploads, 0);
  }
});
test('CORS denies unknown origins and allows configured preflight', async () => {
  const { handler } = backend();
  assert.equal((await handler(request(valid(), pdf(), token(), 'https://evil.example'))).status, 403);
  const response = await handler(new Request('https://test', { method: 'OPTIONS', headers: { Origin: origin } }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
});
test('rejects malformed tokens and excessive request sizes', async () => {
  const { state, handler } = backend();
  assert.equal((await handler(request(valid(), pdf(), 'invalid'))).status, 400);
  const oversized = request(); oversized.headers.set('content-length', String(6 * 1024 * 1024));
  assert.equal((await handler(oversized)).status, 400);
  assert.equal(state.uploads, 0);
});

const require = createRequire(import.meta.url);
const configHandler = require('../api/config.js');
test('public configuration never returns a service-role or secret key', () => {
  const old = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };
  try {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    for (const key of ['sb_secret_private', `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.sig`]) {
      process.env.SUPABASE_PUBLISHABLE_KEY = key;
      const response = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
      configHandler({}, response);
      assert.equal(response.code, 503);
      assert.ok(!JSON.stringify(response.data).includes(key));
    }
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_public';
    const response = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
    configHandler({}, response);
    assert.equal(response.code, 200);
  } finally {
    for (const [name, value] of [['SUPABASE_URL', old.url], ['SUPABASE_PUBLISHABLE_KEY', old.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
