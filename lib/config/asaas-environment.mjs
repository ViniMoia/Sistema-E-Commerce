// Shared by runtime capability checks and the read-only deployment preflight.
// NODE_ENV describes the optimized Next runtime, not the Vercel deployment tier.
export function expectedAsaasEnvironment(env) {
  if (env.VERCEL_ENV === 'production') return 'PRODUCTION';
  if (env.VERCEL === '1' && env.VERCEL_ENV === 'preview') return 'SANDBOX';
  return env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
}

export function asaasGatewayTarget(value) {
  try {
    const url = new URL(value || 'https://api-sandbox.asaas.com/v3');
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
      || !['/v3', '/api/v3'].includes(url.pathname.replace(/\/$/, ''))) return 'INVALID';
    if (url.hostname === 'api.asaas.com') return 'PRODUCTION';
    if (['api-sandbox.asaas.com', 'sandbox.asaas.com'].includes(url.hostname)) return 'SANDBOX';
  } catch { /* Never log URLs or credentials from configuration. */ }
  return 'INVALID';
}

export function asaasConfigurationReady(env, apiUrl, apiKey) {
  if (typeof apiKey !== 'string' || !apiKey) return false;
  const expected = expectedAsaasEnvironment(env);
  if (asaasGatewayTarget(apiUrl) !== expected) return false;
  return expected === 'PRODUCTION' ? apiKey.startsWith('$aact_prod_')
    : apiKey.startsWith('$aact_') && !apiKey.startsWith('$aact_prod_');
}
