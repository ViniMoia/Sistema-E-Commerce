import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

// Evidence, order status, inventory, loyalty and acknowledgement commit as one
// unit. The 5s Prisma default is too short for these DB round trips remotely.
// Keep this bounded and local to evidence transactions; no provider/email I/O
// belongs inside them, and the 10-minute work lease outlives this deadline.
export const paymentEvidenceTransactionOptions = { maxWait: 5000, timeout: 30000 } as const;

const retryCodes = new Set([
  'PAYMENT_ACCOUNT_SCOPE_MISMATCH', 'PAYMENT_LOOKUP_UNAVAILABLE',
  'PAYMENT_LOOKUP_INCOMPLETE', 'PAYMENT_ORDER_NOT_YET_FOUND',
  'PAYMENT_EVENT_REFERENCE_UNRESOLVED', 'PAYMENT_REFERENCE_UNRESOLVED',
  'PAYMENT_PROVIDER_MISMATCH', 'PAYMENT_CORRELATION_CONFLICT',
  'PAYMENT_COMMERCIAL_APPLICATION_RETRY', 'PAYMENT_LEASE_LOST',
  'DURABLE_WORK_LEASE_LOST', 'ASAAS_RESPONSE_TIMEOUT', 'ASAAS_RESPONSE_TOO_LARGE',
]);

// Never log provider responses, Prisma metadata or arbitrary exception text:
// they can include customer data, payment instructions or credentials.
export function paymentRetryCode(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && /^P\d{4}$/.test(error.code)) return error.code;
  if (error instanceof ZodError) return 'PAYMENT_DATA_INVALID';
  if (error instanceof Error && retryCodes.has(error.message)) return error.message;
  return 'PAYMENT_PROCESSING_FAILED';
}
