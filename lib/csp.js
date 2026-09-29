function buildContentSecurityPolicy(nodeEnv = process.env.NODE_ENV) {
  const scriptSources = ["'self'", "'unsafe-inline'"];
  if (nodeEnv !== 'production') scriptSources.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co https://via.placeholder.com https://images.unsplash.com https://api.qrserver.com https://*.mitiendanube.com https://dcdn-us.mitiendanube.com https://res.cloudinary.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://viacep.com.br https://api.asaas.com https://sandbox.asaas.com https://api.resend.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

module.exports = { buildContentSecurityPolicy };

