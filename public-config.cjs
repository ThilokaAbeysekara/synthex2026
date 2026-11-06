// Shared by the build and the optional Vercel configuration endpoint.
function readPublicConfig(env) {
  const url = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const publishableKey = (env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) ||
      !(publishableKey.startsWith('sb_publishable_') || isAnonKey(publishableKey))) {
    throw new Error('Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before building the site. Use a publishable or anon key, never a service-role or secret key.');
  }
  return { url, publishableKey };
}
function isAnonKey(key) {
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; }
  catch { return false; }
}
module.exports = { readPublicConfig };
