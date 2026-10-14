// The audited regression suites; legacy suites outside this list are not certified.
export const homologationSuites = [
  'test-environment-isolation', 'loja-credentials', 'commerce-model',
  'loyalty-simulation-identity', 'purchase-tenant-scope', 'guest-buyer-identity',
  'order-transition-atomicity', 'inventory-admin-integrity', 'inventory-admin-browser', 'cart-mutation-atomicity',
  'loyalty-lot-accounting', 'auth-eligibility-atomicity', 'freight-authority',
  'payment-plan-authority', 'checkout-intent-authority', 'payment-durable-execution',
  'checkout-client-boundaries', 'checkout-browser-state', 'order-fulfillment-atomicity',
  'order-fulfillment-browser', 'customer-financial-metrics',
  'customer-financial-metrics-browser', 'legacy-commerce-compatibility',
  'cart-drawer-browser', 'registration-browser', 'storefront-readiness-browser',
  'payment-process-recovery', 'payment-lifecycle-homologation',
].map(name => `tests/integration/${name}.test.ts`);

export function selectIsolatedSuites(args) {
  if (args.length === 1 && args[0] === '--homologation') return [...homologationSuites];
  const files = args.length ? args : ['tests/integration'];
  if (files.some(file => file.startsWith('--') || file.includes('..')
    || (!/^tests\/(integration|load)\/[a-zA-Z0-9_./-]+$/.test(file)
      && !['tests/integration', 'tests/load'].includes(file)))) {
    throw new Error('Passe somente paths isolados ou --homologation; configuração livre não é aceita.');
  }
  return files;
}
