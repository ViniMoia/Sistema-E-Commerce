// Exactly one configured Asaas account per installation. The stable identifier
// must remain the same during secret rotation; switching accounts is a rollout.
export function paymentAccountScope() {
  const scope = process.env.ASAAS_ACCOUNT_SCOPE ?? 'primary';
  if (!/^[a-zA-Z0-9_-]{1,24}$/.test(scope)) throw new Error('PAYMENT_ACCOUNT_SCOPE_INVALID');
  return scope;
}
