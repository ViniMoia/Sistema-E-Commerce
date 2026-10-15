/** Runtime-only purchase containment. This is not a database writer freeze.
 * Missing preserves existing deployments; invalid configured values fail closed.
 * Apply on every serving revision and drain in-flight commands before DDL.
 */
export function assertCheckoutOpen() {
  const value = process.env.CHECKOUT_PAUSED;
  if (value !== undefined && value !== 'false') throw new Error('CHECKOUT_PAUSED');
}
