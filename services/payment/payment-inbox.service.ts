import { createHash } from 'node:crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { paymentAccountScope } from '@/lib/commerce/payment-account';

// Unknown provider attributes never enter storage (PAN, tokens and PII).
export const webhookEnvelopeSchema = z.object({ id: z.string().min(1).max(160).optional(),
  event: z.string().regex(/^PAYMENT_[A-Z_]{1,48}$/), dateCreated: z.string().max(64).optional(),
  payment: z.object({ id: z.string().min(1).max(128), externalReference: z.string().min(1).max(128).optional(),
    billingType: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']), value: z.number().finite().positive(), status: z.string().min(1).max(64) }) });

export async function receivePaymentEvent(raw: unknown) {
  const safe = webhookEnvelopeSchema.parse(raw);
  // Single Asaas account per installation; scope comes from server config.
  const account = paymentAccountScope();
  const provider = 'ASAAS:' + account;
  const digest = createHash('sha256').update(JSON.stringify(safe)).digest('hex');
  const eventId = safe.id ?? 'fallback:' + digest;
  return prisma.$transaction(async tx => {
    const inbox = await tx.paymentInbox.upsert({ where: { provider_eventId: { provider, eventId } },
      create: { provider, eventId, eventType: safe.event, payload: safe as Prisma.InputJsonValue }, update: {} });
    if (createHash('sha256').update(JSON.stringify(webhookEnvelopeSchema.parse(inbox.payload))).digest('hex') !== digest) throw new Error('WEBHOOK_EVENT_ID_CONTENT_CONFLICT');
    return { eventId, status: inbox.status === 'COMPLETED' ? 'PROCESSED' : inbox.status === 'DEAD_LETTER' ? 'NEEDS_REVIEW' : 'RECEIVED' };
  });
}
