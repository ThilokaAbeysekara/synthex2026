/* Generated during the build; works on Vercel and ordinary static hosting. */
window.synthexConfig = async function () {
  const config = window.SYNTHEX_PUBLIC_CONFIG;
  if (!config?.url || !config?.publishableKey) {
    throw new Error('Submission service is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, then rebuild and redeploy the site.');
  }
  return config;
};

// Gateways can return plain text or HTML for denied/failed requests. Do not
// interpret those responses as JSON or display an internal parser exception.
window.synthexReadSubmissionResponse = async function (response) {
  let result;
  try { result = JSON.parse(await response.text()); }
  catch {
    if (response.status === 401 || response.status === 403) {
      throw new Error('The submission service denied access. Please contact the organizers to check the Supabase function deployment and allowed website origin. Your form has been kept.');
    }
    throw new Error('The submission service returned an unexpected response. Your form has been kept; please try again later.');
  }
  if (!response.ok || !result || result.success !== true || typeof result.id !== 'string' || !result.id) {
    throw new Error((typeof result?.error === 'string' && result.error) || 'Submission failed. Your form has been kept; please try again.');
  }
  return result;
};
