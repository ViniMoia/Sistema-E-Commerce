// Shared by runtime capability checks and the read-only deployment preflight.
// NODE_ENV describes the optimized Next runtime, not the Vercel deployment tier.
export function expectedAsaasEnvironment(env) {
  // Server-only declaration for optimized runtimes outside Vercel (e.g. Google Cloud).
  // Omitting it preserves existing installations; malformed/conflicting declarations
  // disable capabilities rather than silently falling back to another account.
  const declared = env.PAYMENT_DEPLOYMENT_ENVIRONMENT;
  if (declared !== undefined) {
    if (!['SANDBOX', 'PRODUCTION'].includes(declared)) return 'INVALID';
    if (typeof env.ASAAS_ACCOUNT_SCOPE !== 'string' || !/^[a-zA-Z0-9_-]{1,24}$/.test(env.ASAAS_ACCOUNT_SCOPE)) return 'INVALID';
    if (env.VERCEL_ENV === 'production' && declared !== 'PRODUCTION') return 'INVALID';
    if (env.VERCEL === '1') {
      const hostingTarget = env.VERCEL_ENV === 'production' ? 'PRODUCTION'
        : env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development' ? 'SANDBOX' : 'INVALID';
      if (declared !== hostingTarget) return 'INVALID';
    }
    if (declared === 'PRODUCTION' && env.NODE_ENV !== 'production') return 'INVALID';
    return declared;
  }
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
  if (expected === 'INVALID') return false;
  if (asaasGatewayTarget(apiUrl) !== expected) return false;
  return expected === 'PRODUCTION' ? apiKey.startsWith('$aact_prod_')
    : apiKey.startsWith('$aact_') && !apiKey.startsWith('$aact_prod_');
}
