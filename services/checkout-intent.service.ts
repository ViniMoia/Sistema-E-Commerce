import { Prisma, type CheckoutIntent } from '@prisma/client';
import prisma from '@/lib/prisma';
import { checkoutHash } from '@/lib/commerce/checkout-content';
import { normalizeVariantDimension } from '@/lib/product-variants';
import { CommerceLocks } from '@/lib/commerce/locks';
import { buyerInputSchema } from '@/lib/commerce/order-buyer';
import { prepareCheckout } from './checkout-plan.service';
import type { CreateOrderParams } from './checkout.service';
import { checkoutAddresses } from '@/lib/commerce/checkout-address';

export interface CheckoutScope { lojaID: string; customer: { userId?: string; email?: string }; freightOwnerKey?: string }
export async function checkoutNow(tx: Prisma.TransactionClient): Promise<Date> {
  const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  if (!clock?.now) throw new Error('CHECKOUT_CLOCK_UNAVAILABLE');
  return clock.now;
}
export async function withCheckoutOwner<T>(input: CheckoutScope,
  work: (tx: Prisma.TransactionClient, ownerKey: string, locks: CommerceLocks) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    let ownerKey = input.freightOwnerKey;
    if (input.customer.userId) {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${input.customer.userId} FOR SHARE`;
      const user = await tx.user.findUnique({ where: { id: input.customer.userId } });
      if (!user || user.lojaID !== input.lojaID || user.status !== 'ACTIVE' || (input.customer.email &&
        user.email.trim().toLowerCase() !== input.customer.email.trim().toLowerCase())) throw new Error('ACCOUNT_ACCESS_DENIED');
      ownerKey = `u:${user.id}`;
    } else if (!ownerKey || !/^g:[a-f0-9]{64}$/.test(ownerKey)) throw new Error('CHECKOUT_IDENTITY_REQUIRED');
    await tx.$queryRaw`SELECT version FROM "FreightTariffRevision" WHERE id='JT_EXPRESS' FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "Loja" WHERE id=${input.lojaID} FOR SHARE`;
    // Rank before intent/cart: also serializes issuance before an intent exists.
    const scope = JSON.stringify(['checkout-owner-v1', input.lojaID, ownerKey]);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope},0))::text`;
    return work(tx, ownerKey!, new CommerceLocks(tx));
  }, { maxWait: 10000, timeout: 15000 });
}

export function requestFingerprint(input: CreateOrderParams): string {
  const addresses = checkoutAddresses(input);
  const merged = new Map<string, number>();
  for (const i of input.items) {
    const key = JSON.stringify([i.productId, i.variantId ?? null, i.variantId ? '' : normalizeVariantDimension(i.size ?? ''),
      i.variantId ? '' : normalizeVariantDimension(i.color ?? '')]);
    merged.set(key, (merged.get(key) ?? 0) + i.quantity);
  }
  return checkoutHash({ customer: buyerInputSchema.parse(input.customer), userId: input.customer.userId ?? null,
    items: [...merged].sort(([a], [b]) => a < b ? -1 : 1), address: input.address ? { street: input.address.street, number: input.address.number,
      neighborhood: input.address.neighborhood, city: input.address.city, state: input.address.state, cep: input.address.cep,
      complement: input.address.complement ?? '' } : null,
    shippingAddress: addresses.shippingAddress ?? null, billingAddress: addresses.billingAddress ?? null,
    deliveryType: input.deliveryType, freightQuoteToken: input.freightQuoteToken ?? null,
    paymentMethod: input.paymentMethod, installments: input.installments ?? 1, points: input.pointsToRedeem ?? 0 });
}
export interface IntentSnapshot { schemaVersion: 1; input: Omit<CreateOrderParams, 'paymentGateway' | 'creditCard'>;
  requestHash: string; proposal: Awaited<ReturnType<typeof prepareCheckout>>['normalized'] }
export function intentSnapshot(intent: CheckoutIntent): IntentSnapshot {
  const snapshot = intent.snapshot as unknown as IntentSnapshot;
  if (intent.protocolVersion !== 1 || snapshot?.schemaVersion !== 1 || !snapshot.input || !snapshot.proposal ||
    checkoutHash(snapshot.proposal) !== intent.contentHash) throw new Error('CHECKOUT_INTENT_INVALID');
  return snapshot;
}
export async function lockOwnedIntent(tx: Prisma.TransactionClient, locks: CommerceLocks, input: CheckoutScope, ownerKey: string, id: string) {
  const candidate = await tx.checkoutIntent.findFirst({ where: { id, lojaID: input.lojaID, ownerKey } });
  if (!candidate) throw new Error('CHECKOUT_INTENT_NOT_FOUND');
  await locks.acquire('intent', [candidate.id]);
  return tx.checkoutIntent.findUniqueOrThrow({ where: { id: candidate.id } });
}
export async function lockIntentSource(tx: Prisma.TransactionClient, locks: CommerceLocks, intent: CheckoutIntent, ownerKey: string) {
  if (intent.cartID && intent.userID) {
    await locks.acquireCartOwner(intent.lojaID, intent.userID); await locks.acquire('cart', [intent.cartID]);
    const cart = await tx.cart.findUniqueOrThrow({ where: { id: intent.cartID }, include: { items: true } });
    if (cart.lojaID !== intent.lojaID || cart.userID !== intent.userID || cart.status !== 'ACTIVE' || cart.version !== intent.cartVersion) throw new Error('CHECKOUT_CART_CHANGED');
    return cart;
  }
  if (!intent.basketID || intent.userID) throw new Error('CHECKOUT_SOURCE_REQUIRED');
  await tx.$queryRaw`SELECT id FROM "CheckoutBasket" WHERE id=${intent.basketID} FOR UPDATE`;
  const basket = await tx.checkoutBasket.findUniqueOrThrow({ where: { id: intent.basketID } });
  if (basket.lojaID !== intent.lojaID || basket.ownerKey !== ownerKey || basket.status !== 'ACTIVE') throw new Error('CHECKOUT_CART_CHANGED');
  return null;
}
export function proposalDTO(intent: CheckoutIntent, now = new Date()) {
  const snapshot = intentSnapshot(intent);
  return { schemaVersion: 1, checkoutIntentID: intent.id, revision: intent.revision, contentHash: intent.contentHash,
    status: intent.status, serverTime: now.toISOString(), expiresAt: intent.expiresAt.toISOString(), cartID: intent.cartID, cartVersion: intent.cartVersion,
    basketID: intent.basketID, proposal: snapshot.proposal };
}

/** Does not create a new purchase on refresh/retry. Guest continuation is explicit. */
export async function checkoutContext(input: CheckoutScope, previousBasketID?: string) {
  return withCheckoutOwner(input, async (tx, ownerKey) => {
    if (input.customer.userId) {
      const cart = await tx.cart.findFirst({ where: { lojaID: input.lojaID, userID: input.customer.userId, status: 'ACTIVE' }, select: { id: true, version: true } });
      return { cartID: cart?.id ?? null, cartVersion: cart?.version ?? null, basketID: null };
    }
    const existing = await tx.checkoutBasket.findFirst({ where: { lojaID: input.lojaID, ownerKey }, orderBy: { generation: 'desc' } });
    if (existing?.status === 'ACTIVE' || (existing && !previousBasketID)) return { cartID: null, cartVersion: null, basketID: existing.id };
    if (existing) {
      if (previousBasketID !== existing.id) throw new Error('CHECKOUT_NEW_PURCHASE_CONFLICT');
      const intent = await tx.checkoutIntent.findUnique({ where: { basketID: existing.id }, include: { order: { include: {
        paymentAttempts: { orderBy: { number: 'desc' }, take: 1 } } } } });
      const attempt = intent?.order?.paymentAttempts[0];
      if (!attempt || ['SUBMITTING', 'UNKNOWN', 'CANCEL_PENDING', 'REFUND_PENDING'].includes(attempt.status) ||
        (attempt.status === 'APPROVED' && intent?.order?.status === 'PENDING')) throw new Error('PAYMENT_RECONCILIATION_REQUIRED');
    } else if (previousBasketID) throw new Error('CHECKOUT_NEW_PURCHASE_CONFLICT');
    const basket = await tx.checkoutBasket.create({ data: { lojaID: input.lojaID, ownerKey, generation: (existing?.generation ?? -1) + 1 } });
    return { cartID: null, cartVersion: null, basketID: basket.id };
  });
}

export async function proposeCheckout(params: CreateOrderParams) {
  return withCheckoutOwner(params, async (tx, ownerKey, locks) => {
    let existing: CheckoutIntent | null;
    if (params.customer.userId) {
      if (!params.cartID || !Number.isInteger(params.cartVersion)) throw new Error('CHECKOUT_SOURCE_REQUIRED');
      existing = await tx.checkoutIntent.findUnique({ where: { cartID_cartVersion: { cartID: params.cartID, cartVersion: params.cartVersion! } } });
    } else {
      if (!params.basketID) throw new Error('CHECKOUT_SOURCE_REQUIRED');
      existing = await tx.checkoutIntent.findUnique({ where: { basketID: params.basketID } });
    }
    if (existing && (existing.lojaID !== params.lojaID || existing.ownerKey !== ownerKey)) throw new Error('CHECKOUT_INTENT_NOT_FOUND');
    if (existing) {
      await locks.acquire('intent', [existing.id]);
      const order = await tx.order.findUnique({ where: { checkoutIntentID_lojaID: { checkoutIntentID: existing.id, lojaID: params.lojaID } } });
      // Caller can recover the immutable placed intent; no recalculation/charge.
      if (order) {
        if (requestFingerprint(params) !== intentSnapshot(existing).requestHash) throw new Error('CHECKOUT_CONTENT_CONFLICT');
        return proposalDTO(existing, await checkoutNow(tx));
      }
    }
    const source = existing ?? { cartID: params.cartID ?? null, cartVersion: params.cartVersion ?? null,
      basketID: params.basketID ?? null, userID: params.customer.userId ?? null, lojaID: params.lojaID } as CheckoutIntent;
    const cart = await lockIntentSource(tx, locks, source, ownerKey);
    if (cart) {
      const requested = new Map<string, number>();
      for (const i of params.items) {
        if (!i.variantId || !Number.isInteger(i.quantity) || i.quantity < 1) throw new Error('CHECKOUT_CART_CHANGED');
        const key = `${i.productId}:${i.variantId}`; requested.set(key, (requested.get(key) ?? 0) + i.quantity);
      }
      const stored = cart.items.map(i => [`${i.productID}:${i.variantID}`, i.quantity] as const).sort(([a], [b]) => a < b ? -1 : 1);
      if (checkoutHash([...requested].sort(([a], [b]) => a < b ? -1 : 1)) !== checkoutHash(stored) || !stored.length) throw new Error('CHECKOUT_CART_CHANGED');
    }
    const prepared = await prepareCheckout(tx, { ...params, acceptedFinancialTotal: undefined, installmentValue: undefined }, true);
    const now = await checkoutNow(tx);
    const requestHash = requestFingerprint(params);
    if (existing && existing.contentHash === prepared.hash && intentSnapshot(existing).requestHash === requestHash && existing.expiresAt.getTime() > now.getTime()) return proposalDTO(existing, now);
    // Persist only an explicit whitelist; transient card and transport keys cannot
    // reach JSON even if future callers extend CreateOrderParams.
    const input: IntentSnapshot['input'] = { lojaID: params.lojaID, customer: { name: params.customer.name,
      email: params.customer.email, phone: params.customer.phone, cpfCnpj: params.customer.cpfCnpj, userId: params.customer.userId },
      items: prepared.items.map(i => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
      address: params.address ? { state: params.address.state, city: params.address.city, neighborhood: params.address.neighborhood,
        street: params.address.street, number: params.address.number, complement: params.address.complement, cep: params.address.cep } : undefined,
      shippingAddress: params.shippingAddress, billingAddress: params.billingAddress, billingSameAsShipping: params.billingSameAsShipping,
      deliveryType: params.deliveryType, freightQuoteToken: params.freightQuoteToken,
      freightOwnerKey: ownerKey, paymentMethod: params.paymentMethod, pointsToRedeem: params.pointsToRedeem ?? 0,
      installments: params.installments ?? 1, acceptedFinancialTotal: Number(prepared.financial.plan.financialTotal),
      cartID: params.cartID, cartVersion: params.cartVersion, basketID: params.basketID };
    const snapshot = JSON.parse(JSON.stringify({ schemaVersion: 1, input, proposal: prepared.normalized, requestHash }));
    const expiry = new Date(Math.min(now.getTime() + 15 * 60000,
      'expiresAt' in prepared.freight ? (prepared.freight.expiresAt as Date).getTime() : Infinity));
    const data = { protocolVersion: 1, contentHash: prepared.hash, snapshot, status: 'OPEN' as const, expiresAt: expiry };
    const intent = existing ? await tx.checkoutIntent.update({ where: { id: existing.id }, data: { ...data, revision: { increment: 1 } } }) :
      await tx.checkoutIntent.create({ data: { ...data, lojaID: params.lojaID, ownerKey, userID: params.customer.userId,
        cartID: params.cartID, cartVersion: params.cartVersion, basketID: params.basketID,
        key: params.cartID ? `cart:${params.cartID}:${params.cartVersion}` : `basket:${params.basketID}`, revision: 1 } });
    return proposalDTO(intent, now);
  });
}
