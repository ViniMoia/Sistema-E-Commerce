import { randomBytes } from 'node:crypto';
import prisma from '@/lib/prisma';
import { prepareCheckout } from '@/services/checkout-plan.service';
import { proposeCheckout, checkoutContext, withCheckoutOwner } from '@/services/checkout-intent.service';
import { createOrder as completeCheckout, type CreateOrderParams } from '@/services/checkout.service';
export type { CreateOrderParams } from '@/services/checkout.service';
const accepted = new WeakMap<object, CreateOrderParams>();
const keyed = new Map<string, CreateOrderParams>();

/** Older domain integration suites now exercise proposal -> consent -> completion.
 * All fixture writes are scoped to their disposable store, never a production bypass. */
export async function acceptFixtureCheckout(input: CreateOrderParams) {
  const identity = input.freightOwnerKey ?? (input.customer.userId ? `u:${input.customer.userId}` : `g:${randomBytes(32).toString('hex')}`);
  const params = { ...input, freightOwnerKey: identity };
  // Validate the original submitted financial consent/preflight in those domain
  // tests before constructing a source fixture. Production proposal quotes its own total.
  const prepared = await withCheckoutOwner(params, tx => prepareCheckout(tx, params));
  if (params.customer.userId) {
    if (!params.cartID) {
      const active = await prisma.cart.findFirst({ where: { lojaID: params.lojaID, userID: params.customer.userId, status: 'ACTIVE' } });
      if (active) await prisma.cart.update({ where: { id: active.id }, data: { status: 'ABANDONED' } });
      const cart = await prisma.cart.create({ data: { lojaID: params.lojaID, userID: params.customer.userId,
        items: { create: prepared.items.map(i => ({ productID: i.productId, variantID: i.variantId,
          quantity: i.quantity, price: i.price, productName: i.name, imageUrl: '', color: i.color, size: i.size })) } } });
      params.cartID = cart.id; params.cartVersion = cart.version;
    }
    params.items = prepared.items.map(i => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));
  } else if (!params.basketID) {
    let context = await checkoutContext(params);
    const current = await prisma.checkoutBasket.findUniqueOrThrow({ where: { id: context.basketID! } });
    if (current.status !== 'ACTIVE') context = await checkoutContext(params, current.id);
    params.basketID = context.basketID!;
  }
  const proposal = await proposeCheckout(params);
  return { ...params, checkoutIntentID: proposal.checkoutIntentID, acceptedRevision: proposal.revision, acceptedContentHash: proposal.contentHash };
}
export async function createOrder(input: CreateOrderParams) {
  if (input.checkoutIntentID) return completeCheckout(input);
  const key = input.idempotencyKey ? JSON.stringify([input.lojaID, input.customer.userId ?? input.freightOwnerKey, input.idempotencyKey]) : null;
  const previous = accepted.get(input) ?? (key ? keyed.get(key) : null);
  const params = previous ? { ...input, cartID: previous.cartID, cartVersion: previous.cartVersion,
    basketID: previous.basketID, checkoutIntentID: previous.checkoutIntentID, acceptedRevision: previous.acceptedRevision,
    acceptedContentHash: previous.acceptedContentHash, freightOwnerKey: previous.freightOwnerKey, items: previous.items } : await acceptFixtureCheckout(input);
  accepted.set(input, params); if (key) keyed.set(key, params);
  return completeCheckout(params);
}

/** Explicit manual-payment fixture adapter for the old cart-domain tests. The
 * production service rejects this incomplete contract; this helper issues and
 * accepts a real proposal before it delegates to the canonical command. */
export async function createOrderFromCart(input: import('@/types/order.types').CreateOrderInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userID } });
  if (user.lojaID !== input.lojaID || user.status !== 'ACTIVE') throw new Error('ACCOUNT_ACCESS_DENIED');
  const address = await prisma.address.findUniqueOrThrow({ where: { id: input.addressID } });
  if (address.userID !== input.userID) throw new Error('ADDRESS_ACCESS_DENIED');
  const cart = await prisma.cart.findUniqueOrThrow({ where: { id: input.cartID }, include: { items: true } });
  const params: CreateOrderParams = { lojaID: input.lojaID, customer: { userId: user.id, name: user.name, email: user.email, phone: user.phone ?? '11999999999' },
    cartID: cart.id, cartVersion: cart.status === 'COMPLETED' ? cart.version - 1 : cart.version,
    address: { ...address, neighborhood: address.district, complement: address.complement ?? undefined }, deliveryType: 'DELIVERY',
    paymentMethod: 'WHATSAPP_PIX', freightQuoteToken: input.freightQuoteToken, items: cart.items.map(i => ({ productId: i.productID, variantId: i.variantID, quantity: i.quantity })) };
  const proposal = await proposeCheckout(params);
  return (await completeCheckout({ ...params, checkoutIntentID: proposal.checkoutIntentID, acceptedRevision: proposal.revision, acceptedContentHash: proposal.contentHash })).order;
}
