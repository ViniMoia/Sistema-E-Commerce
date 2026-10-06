import { Prisma, DeliveryType } from '@prisma/client';
import { z } from 'zod';
import { verifyFreightQuote } from '@/lib/freight-quote';
import { loadFreightAuthority, type FreightItems } from './authority';
import { destinationSchema, normalizeMunicipality } from './destination';
import { freightQuoteBinding } from '@/services/freight/orchestrator.service';

/** Explicit zero-price store policy needs no client-selected amount. */
export async function authorizeFreeFreight(tx: Prisma.TransactionClient, lojaID: string, deliveryType: 'PICKUP' | 'NONE') {
  await tx.$queryRaw`SELECT id FROM "Loja" WHERE id = ${lojaID} FOR SHARE`;
  const loja = await tx.loja.findUniqueOrThrow({ where: { id: lojaID } });
  if (deliveryType === 'PICKUP' ? !loja.enablePickup : !loja.enableNoFreight) throw new Error('FREIGHT_METHOD_DISABLED');
  return { id: null, amount: new Prisma.Decimal(0), provider: deliveryType === 'PICKUP' ? 'STORE_PICKUP' : 'NONE',
    serviceName: deliveryType === 'PICKUP' ? 'Retirada na Loja' : 'A Combinar via WhatsApp', estimatedDays: 0,
    snapshot: { schemaVersion: 2, deliveryType, configurationVersion: loja.configurationVersion, policy: 'enabled-store-zero-price' } };
}

export async function acceptFreightQuote(tx: Prisma.TransactionClient, input: {
  lojaID: string; ownerKey?: string; items: FreightItems; deliveryType: DeliveryType; token?: string;
  address?: { cep: string; state: string; city: string };
}) {
  if (!input.token || !input.ownerKey) throw new Error('FREIGHT_QUOTE_REQUIRED');
  const token = verifyFreightQuote(input.token);
  const row = await tx.freightQuote.findUnique({ where: { id: token.quoteId } });
  if (!row || row.lojaID !== input.lojaID || row.ownerKey !== input.ownerKey || row.deliveryType !== input.deliveryType || !row.fingerprint || !row.serviceCode) throw new Error('FREIGHT_QUOTE_INVALID');
  const snapshot = z.object({ schemaVersion: z.literal(2), destination: destinationSchema.nullable(),
    originCep: z.string().nullable(), declaredValue: z.string().regex(/^\d+\.\d{2}$/),
    packages: z.object({ weightInGrams: z.number().positive(), lengthCm: z.number().positive(), widthCm: z.number().positive(), heightCm: z.number().positive() }),
  }).strict().parse(row.snapshot);
  const destination = snapshot.destination;
  if (input.deliveryType === 'DELIVERY') {
    if (!destination || !input.address || input.address.cep.replace(/\D/g, '') !== destination.cep ||
      input.address.state.trim().toUpperCase() !== destination.state || normalizeMunicipality(input.address.city) !== normalizeMunicipality(destination.city)) throw new Error('FREIGHT_DESTINATION_MISMATCH');
  } else if (destination) throw new Error('FREIGHT_QUOTE_INVALID');
  const current = await loadFreightAuthority(tx, input.lojaID, input.items, destination, true);
  if (row.expiresAt.getTime() <= current.now.getTime() || token.expiresAt !== row.expiresAt.getTime() ||
      token.bindingHash !== freightQuoteBinding(row) || current.fingerprint !== row.fingerprint ||
      current.contentHash !== row.cartContentHash || current.destinationHash !== row.destinationHash ||
      current.loja.configurationVersion !== row.configurationVersion) throw new Error('FREIGHT_REQUOTE_REQUIRED');
  if ((row.provider === 'STORE_PICKUP' && (!current.loja.enablePickup || input.deliveryType !== 'PICKUP')) ||
      (row.provider === 'NONE' && (!current.loja.enableNoFreight || input.deliveryType !== 'NONE')) ||
      (input.deliveryType === 'DELIVERY' && ['NONE', 'STORE_PICKUP'].includes(row.provider)) ||
      (row.provider === 'CORREIOS' && !current.loja.enableCorreios)) throw new Error('FREIGHT_REQUOTE_REQUIRED');
  return { ...row, authoritativeItems: current.providerItems, snapshot: { ...snapshot, quoteId: row.id, configurationVersion: row.configurationVersion,
    fingerprint: row.fingerprint, serviceCode: row.serviceCode, provider: row.provider,
    amount: row.amount.toFixed(2), expiresAt: row.expiresAt.toISOString(), acceptedAt: current.now.toISOString() } };
}
