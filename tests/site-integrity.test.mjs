import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

for (const name of ['index.html', 'about.html', 'submit.html']) {
  test(`${name} keeps registration local and references existing local resources`, async () => {
    const html = await readFile(name, 'utf8');
    assert.doesNotMatch(html, /script\.google\.com|docs\.google\.com\/forms|^<<<<<<<|^>>>>>>>|^=======$/m);
    assert.doesNotMatch(html, /custom-script-url|export-csv-btn|test-connection-btn/);
    for (const [, link] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      if (/^(https?:|data:|mailto:|tel:)/.test(link) || link === 'public-config.js') continue;
      await access(link.split('?')[0]);
    }
    if (name !== 'submit.html') assert.match(html, /href="submit\.html"/);
  });
}
test('browser code parses and contains no Google submission paths or browser-local success fallback', async () => {
  const app = await readFile('app.js', 'utf8');
  new vm.Script(app);
  assert.doesNotMatch(app, /script\.google\.com|docs\.google\.com\/forms|localStorage|readFileAsBase64|transmitToGoogleSheets/);
  assert.match(app, /functions\/v1\/submit-research/);
  assert.match(app, /window\.location\.href = "submit\.html"/);
});
test('Vercel builds public config and serves the root website', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal(config.outputDirectory, '.');
  assert.equal(config.buildCommand, 'npm run build');
  assert.ok(config.headers.find(entry => entry.source === '/(.*)').headers.some(header => header.key === 'X-Frame-Options'));
});
