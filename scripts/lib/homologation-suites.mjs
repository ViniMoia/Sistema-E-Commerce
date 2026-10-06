// The audited regression suites; legacy suites outside this list are not certified.
export const homologationSuites = [
  'test-environment-isolation', 'loja-credentials', 'commerce-model',
  'loyalty-simulation-identity', 'purchase-tenant-scope', 'guest-buyer-identity',
  'order-transition-atomicity', 'inventory-admin-integrity', 'cart-mutation-atomicity',
  'loyalty-lot-accounting', 'auth-eligibility-atomicity', 'freight-authority',
  'payment-plan-authority', 'checkout-intent-authority', 'payment-durable-execution',
  'checkout-client-boundaries', 'checkout-browser-state', 'order-fulfillment-atomicity',
  'order-fulfillment-browser', 'customer-financial-metrics',
  'customer-financial-metrics-browser', 'legacy-commerce-compatibility',
].map(name => `tests/integration/${name}.test.ts`);
