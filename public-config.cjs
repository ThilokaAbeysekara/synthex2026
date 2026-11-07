// Shared by the build and the optional Vercel configuration endpoint.
const { validatePublicConfig } = require('./config-validation.js');
function readPublicConfig(env) {
  const url = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const publishableKey = (env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  return validatePublicConfig({ url, publishableKey });
}
module.exports = { readPublicConfig };
