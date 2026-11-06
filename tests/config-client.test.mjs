import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdir, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const source = await readFile(new URL('../supabase-client.js', import.meta.url), 'utf8');
function client(config) {
  const context = { window: { SYNTHEX_PUBLIC_CONFIG: config },
    fetch() { throw new Error('The form must not depend on /api/config'); } };
  vm.runInNewContext(source, context);
  return context.window;
}

test('submission config works on a static host without an API request', async () => {
  const config = { url: 'https://test.supabase.co', publishableKey: 'sb_publishable_test' };
  assert.equal(await client(config).synthexConfig(), config);
});
test('missing build config gives an actionable error instead of a JSON parser exception', async () => {
  await assert.rejects(client().synthexConfig(), /SUPABASE_URL.*SUPABASE_PUBLISHABLE_KEY/);
});
for (const status of [401, 403]) {
  test(`plain-text Forbidden (${status}) is handled without a JSON parser exception`, async () => {
    await assert.rejects(client().synthexReadSubmissionResponse(new Response('Forbidden.', { status })),
      /denied access.*Your form has been kept/);
  });
}
test('HTML gateway failure is handled clearly', async () => {
  await assert.rejects(client().synthexReadSubmissionResponse(new Response('<html>Bad Gateway</html>', { status: 502 })), /unexpected response/);
});
test('valid confirmation succeeds and JSON submission errors are retained', async () => {
  const runtime = client();
  assert.equal((await runtime.synthexReadSubmissionResponse(Response.json({ success: true, id: 'SYNTHEX-TEST' }))).id, 'SYNTHEX-TEST');
  await assert.rejects(runtime.synthexReadSubmissionResponse(Response.json({ error: 'Duplicate submission' }, { status: 409 })), /Duplicate submission/);
  await assert.rejects(runtime.synthexReadSubmissionResponse(Response.json(null)), /Submission failed/);
});
test('build writes only public config and rejects a service-role key', async () => {
  const base = resolve('test-results');
  await mkdir(base, { recursive: true });
  const folder = await mkdtemp(resolve(base, 'config-'));
  try {
    await mkdir(resolve(folder, 'scripts'));
    await copyFile(resolve('public-config.cjs'), resolve(folder, 'public-config.cjs'));
    await copyFile(resolve('scripts/build-config.cjs'), resolve(folder, 'scripts/build-config.cjs'));
    const env = { ...process.env, SUPABASE_URL: ' https://test.supabase.co/ ',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: 'private-test-secret' };
    const run = key => spawnSync(process.execPath, ['scripts/build-config.cjs'], {
      cwd: folder, env: { ...env, SUPABASE_PUBLISHABLE_KEY: key }, encoding: 'utf8'
    });
    const result = run(env.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(result.status, 0, result.stderr);
    const output = await readFile(resolve(folder, 'public-config.js'), 'utf8');
    assert.ok(output.includes('https://test.supabase.co'));
    assert.ok(!output.includes('private-test-secret'));
    assert.ok(!output.includes('SERVICE_ROLE'));
    assert.equal(run('sb_secret_should_never_be_public').status, 1);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
