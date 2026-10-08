import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { paymentRetryCode } from '@/services/payment/payment-execution-policy';

describe('safe payment retry diagnostics', () => {
  it.each(['P2028', 'P2002'])('reports Prisma %s without exception text or metadata', code => {
    const error = new Prisma.PrismaClientKnownRequestError('private response / credentials', {
      code, clientVersion: '5.22.0', meta: { private: 'customer and payment data' },
    });
    expect(paymentRetryCode(error)).toBe(code);
  });
  it('reports validation without rejected values or paths', () => {
    const result = z.object({ privateCustomerField: z.number() }).safeParse({ privateCustomerField: 'private data' });
    expect(result.success).toBe(false);
    if (!result.success) expect(paymentRetryCode(result.error)).toBe('PAYMENT_DATA_INVALID');
  });
  it.each(['PAYMENT_LOOKUP_UNAVAILABLE', 'ASAAS_RESPONSE_TIMEOUT', 'PAYMENT_COMMERCIAL_APPLICATION_RETRY'])('retains the known code %s', code => {
    expect(paymentRetryCode(new Error(code))).toBe(code);
  });
  it.each([new Error('PAYMENT_PRIVATE_SECRET'), new Error('https://user:password@example.invalid'),
    { code: 'P2028', message: 'untrusted response' }, null])('does not echo unknown errors', error => {
    expect(paymentRetryCode(error)).toBe('PAYMENT_PROCESSING_FAILED');
  });
});
