import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const nuvemshopWebhookEventSchema = z.object({
  store_id: z.union([
    z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    z.string().regex(/^[1-9]\d*$/),
  ]).transform(String),
  event: z.string().trim().min(3).max(64).regex(/^[a-z_]+\/[a-z_]+$/),
  id: z.union([
    z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    z.string().regex(/^[1-9]\d*$/),
  ]).transform(String),
}).passthrough();

export type NuvemshopWebhookPayload = z.infer<typeof nuvemshopWebhookEventSchema>;

export interface NuvemshopWebhookReceipt {
  received: true;
  eventId: string;
  storeId: string;
  event: string;
  resourceId: string;
  isDuplicate: boolean;
}

/**
 * Constant-time verification of Nuvemshop HMAC signature.
 * Header: x-linkedstore-hmac-sha256
 * Algorithm: HMAC-SHA256(rawBody, secret)
 */
export function verifyNuvemshopWebhookHmac(
  rawBody: string,
  signature: string | null | undefined,
  secret: string
): boolean {
  if (!signature || !secret || typeof rawBody !== 'string' || rawBody.length === 0) {
    return false;
  }
  const cleanSig = signature.trim().toLowerCase();
  const expectedHmac = createHmac('sha256', secret).update(rawBody).digest('hex').toLowerCase();

  const sigBuffer = Buffer.from(cleanSig, 'utf8');
  const expectedBuffer = Buffer.from(expectedHmac, 'utf8');

  if (sigBuffer.byteLength !== expectedBuffer.byteLength) {
    return false;
  }
  return timingSafeEqual(sigBuffer, expectedBuffer);
}

export interface ReceiveNuvemshopWebhookOptions {
  rawBody: string;
  signature: string | null | undefined;
  secret?: string;
  expectedStoreId?: string;
}

/**
 * Ingests, validates and persists an incoming Nuvemshop webhook event.
 * No synchronous external mutation, slow catalog sync or payment changes occur here.
 */
export async function receiveNuvemshopWebhook(
  options: ReceiveNuvemshopWebhookOptions
): Promise<NuvemshopWebhookReceipt> {
  const secret = options.secret ?? process.env.NUVEMSHOP_CLIENT_SECRET ?? process.env.NUVEMSHOP_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('NUVEMSHOP_WEBHOOK_SECRET_NOT_CONFIGURED');
  }

  const isValid = verifyNuvemshopWebhookHmac(options.rawBody, options.signature, secret);
  if (!isValid) {
    throw new Error('NUVEMSHOP_WEBHOOK_HMAC_INVALID');
  }

  let json: unknown;
  try {
    json = JSON.parse(options.rawBody);
  } catch {
    throw new Error('NUVEMSHOP_WEBHOOK_INVALID_JSON');
  }

  const parsed = nuvemshopWebhookEventSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('NUVEMSHOP_WEBHOOK_PAYLOAD_INVALID');
  }

  const payload = parsed.data;
  const configuredStore = options.expectedStoreId ?? process.env.NUVEMSHOP_STORE_ID;
  if (configuredStore && payload.store_id !== configuredStore) {
    throw new Error('NUVEMSHOP_WEBHOOK_STORE_MISMATCH');
  }

  const bodyDigest = createHash('sha256').update(options.rawBody).digest('hex');
  const eventId = `nuvemshop:${payload.store_id}:${payload.event}:${payload.id}:${bodyDigest.slice(0, 16)}`;
  const provider = `NUVEMSHOP:${payload.store_id}`;

  const result = await prisma.$transaction(async tx => {
    const existing = await tx.paymentWebhookEvent.findUnique({
      where: { eventId },
      select: { id: true },
    });

    if (existing) {
      return { isDuplicate: true };
    }

    await tx.paymentWebhookEvent.create({
      data: {
        eventId,
        provider,
        eventType: payload.event,
        payload: payload as Prisma.InputJsonValue,
      },
    });

    return { isDuplicate: false };
  });

  return {
    received: true,
    eventId,
    storeId: payload.store_id,
    event: payload.event,
    resourceId: payload.id,
    isDuplicate: result.isDuplicate,
  };
}
