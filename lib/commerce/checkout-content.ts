import { createHash, createHmac } from 'node:crypto';

/** Stable recursive encoding: hash server-normalized business data, never PAN,
 * CVV, transport keys, browser totals or object insertion order. */
export function checkoutHash(value: unknown): string {
  const normalize = (v: unknown): unknown => v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(normalize) :
    v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => a < b ? -1 : 1).map(([k, x]) => [k, normalize(x)])) : v;
  return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
}

/** Recoverable guest order capability, exposed only after cookie-scope checks.
 * Domain separated from quote signatures. Rotation requires recovery policy. */
export function guestCheckoutAccess(ownerKey: string, intentID: string) {
  const key = process.env.FREIGHT_QUOTE_SECRET || (process.env.NODE_ENV !== 'production'
    ? 'default-development-freight-quote-secret-32-chars-long' : '');
  if (key.length < 32) throw new Error('FREIGHT_QUOTE_SECRET_MISSING');
  const token = createHmac('sha256', key).update(JSON.stringify(['checkout-order-recovery-v1', ownerKey, intentID])).digest('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}
