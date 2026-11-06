// Run on a trusted machine only. Dry run unless --apply is supplied.
const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this process environment.');
const headers = { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };
async function api(path, options = {}) {
  const response = await fetch(`${url}${path}`, { ...options, headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Maintenance request failed (${response.status}). No further files will be deleted.`);
  return response.json();
}
async function committedPaths() {
  const paths = new Set();
  for (let offset = 0; ; offset += 500) {
    const rows = await api(`/rest/v1/research_submissions?select=file_path&order=id&limit=500&offset=${offset}`);
    rows.forEach(row => paths.add(row.file_path));
    if (rows.length < 500) return paths;
  }
}
const referenced = await committedPaths();
const cutoff = Date.now() - 24 * 60 * 60 * 1000;
const candidates = [];
async function list(prefix = '') {
  for (let offset = 0; ; offset += 500) {
    const objects = await api('/storage/v1/object/list/concept-papers', {
      method: 'POST', body: JSON.stringify({ prefix, limit: 500, offset, sortBy: { column: 'name', order: 'asc' } })
    });
    for (const object of objects) {
      const path = prefix ? `${prefix}/${object.name}` : object.name;
      if (!object.id) await list(path);
      else if (!referenced.has(path) && object.created_at && Date.parse(object.created_at) < cutoff) candidates.push(path);
    }
    if (objects.length < 500) break;
  }
}
await list();
console.log(`${candidates.length} unreferenced PDFs older than 24 hours.`);
for (const path of candidates) {
  // Recheck immediately before deleting; never delete a committed paper.
  const current = await api(`/rest/v1/research_submissions?select=id&file_path=eq.${encodeURIComponent(path)}&limit=1`);
  if (current.length) continue;
  if (process.argv.includes('--apply')) {
    await api('/storage/v1/object/concept-papers', { method: 'DELETE', body: JSON.stringify({ prefixes: [path] }) });
    console.log(`Removed ${path}`);
  } else console.log(`Would remove ${path}`);
}
if (!process.argv.includes('--apply')) console.log('Dry run only. Inspect the list, then rerun with --apply to remove these orphan files.');
