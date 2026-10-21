import { z } from 'zod';

// Provider-controlled payer form, never a redirect supplied by the operator.
export function boletoRefundUrl(raw: unknown, environment?: string): string | null {
  if (typeof raw !== 'string' || raw.length > 2048 || /[\s\\]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    const hosts = environment === 'SANDBOX' ? ['sandbox.asaas.com'] : environment === 'PRODUCTION'
      ? ['www.asaas.com', 'asaas.com'] : environment === undefined
        ? ['sandbox.asaas.com', 'www.asaas.com', 'asaas.com'] : [];
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
      hosts.includes(url.hostname) && url.pathname !== '/' ? url.href : null;
  } catch { return null; }
}

export const boletoRefundViewSchema = z.object({
  orderId: z.string(), version: z.number().int(), applicable: z.boolean(), eligible: z.boolean(),
  amount: z.string(), state: z.enum(['UNAVAILABLE', 'AVAILABLE', 'QUEUED', 'AWAITING_CUSTOMER', 'REVIEW', 'COMPLETED']),
  requestUrl: z.string().refine(value => boletoRefundUrl(value) !== null).nullable(),
});
export type BoletoRefundView = z.infer<typeof boletoRefundViewSchema>;
