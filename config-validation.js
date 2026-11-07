/* Validate public configuration identically in the build and the browser. */
(function () {
  function validatePublicConfig(input) {
    const url = String(input?.url || '').trim().replace(/\/+$/, '');
    const publishableKey = String(input?.publishableKey || '').trim();
    const match = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/);
    if (!match || /^(test|example|demo|your-project-ref|placeholder)$/.test(match[1]) ||
        /^(sb_publishable_)?(test|public|your[_-]|placeholder|example)/i.test(publishableKey)) {
      throw new Error('Submission service needs your real SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Configure them, rebuild, and reload the page.');
    }
    let validKey = publishableKey.startsWith('sb_publishable_');
    if (!validKey) {
      try {
        const encoded = publishableKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(encoded));
        validKey = payload.role === 'anon' && (!payload.ref || payload.ref === match[1]);
      } catch { validKey = false; }
    }
    if (!validKey) throw new Error('Invalid Supabase public key. Use the publishable or anon key for the configured project, never a service-role or secret key.');
    return { url, publishableKey };
  }
  if (typeof module === 'object' && module.exports) module.exports = { validatePublicConfig };
  else window.synthexValidatePublicConfig = validatePublicConfig;
})();
