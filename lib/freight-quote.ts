import crypto from 'node:crypto';
import { z } from 'zod';
const payloadSchema = z.object({ version: z.literal(2), quoteId: z.string().uuid(),
  bindingHash: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.number().int().positive() }).strict();
export type FreightQuotePayload = z.infer<typeof payloadSchema>;
function secret() {
  const key = process.env.FREIGHT_QUOTE_SECRET || (process.env.NODE_ENV !== 'production' ? 'default-development-freight-quote-secret-32-chars-long' : '');
  if (key.length < 32) throw new Error('FREIGHT_QUOTE_SECRET_MISSING');
  return key;
}
const signature = (payload: string) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
export function assertFreightSigningReady(): void { secret(); }
export function signFreightQuote(data: Omit<FreightQuotePayload, 'version'>): string {
  const encoded = Buffer.from(JSON.stringify(payloadSchema.parse({ ...data, version: 2 }))).toString('base64url');
  return encoded + '.' + signature(encoded);
}
export function verifyFreightQuote(token: string): FreightQuotePayload {
  if (typeof token !== 'string' || token.length > 2048) throw new Error('FREIGHT_QUOTE_INVALID');
  const segments = token.split('.');
  const [encoded, received] = segments;
  if (segments.length !== 2 || !encoded || !received) throw new Error('FREIGHT_QUOTE_INVALID');
  const expected = Buffer.from(signature(encoded)); const actual = Buffer.from(received);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('FREIGHT_QUOTE_INVALID');
  try { return payloadSchema.parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))); }
  catch { throw new Error('FREIGHT_QUOTE_INVALID'); }
}
