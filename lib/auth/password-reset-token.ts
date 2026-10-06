import { createHash } from 'node:crypto';

// Only the random bearer is accepted at the boundary; its stored digest is not
// itself a usable recovery credential. Old plaintext links must be reissued.
export function digestPasswordResetToken(token: string): string | null {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  return `h1:${createHash('sha256').update(token).digest('hex')}`;
}
