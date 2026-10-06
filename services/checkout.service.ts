import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { buyerSelect } from '@/lib/commerce/order-buyer';
import { guestCheckoutAccess, checkoutHash } from '@/lib/commerce/checkout-content';
import { debitRedeemedPoints } from '@/services/loyalty.service';
import { InventoryService } from '@/services/inventory.service';
import { executePaymentAttempt } from '@/services/payment/checkout-payment.service';
import { prepareCheckout } from './checkout-plan.service';
import { withCheckoutOwner, lockOwnedIntent, lockIntentSource, intentSnapshot, requestFingerprint, proposalDTO, checkoutNow, type CheckoutScope } from './checkout-intent.service';
import { purchaseResultFromOrder, purchaseInclude } from '@/lib/commerce/purchase-result';
import { creditCardSchema } from '@/lib/validators/checkout.validators';
import type { PaymentGateway, PaymentMethod, CreditCardData } from '@/types/payment-gateway.types';
import { paymentAccountScope } from '@/lib/commerce/payment-account';
import { checkoutAddresses } from '@/lib/commerce/checkout-address';

export interface CheckoutCartItem {
  productId?: string
  variantId?: string
  name?: string
  quantity: number
  price?: number
  color?: string
  size?: string
}

export interface CheckoutCustomerData {
  name: string
  email: string
  phone: string
  cpfCnpj?: string
  userId?: string
}

export interface CheckoutAddressData {
  state: string
  city: string
  neighborhood: string
  street: string
  number: string
  complement?: string
  cep: string
}

export interface CreateOrderParams {
  lojaID: string
  checkoutIntentID?: string
  acceptedRevision?: number
  acceptedContentHash?: string
  cartID?: string
  cartVersion?: number
  basketID?: string
  orderAccessToken?: string
  customer: CheckoutCustomerData
  items: CheckoutCartItem[]
  address?: CheckoutAddressData
  shippingAddress?: CheckoutAddressData
  billingAddress?: CheckoutAddressData
  billingSameAsShipping?: boolean
  deliveryType: 'DELIVERY' | 'PICKUP' | 'NONE'
  freightQuoteToken?: string
  freightOwnerKey?: string // Trusted HTTP context, never accepted from request body.
  freightValue?: number
  shippingCost?: number
  shippingProvider?: string
  shippingServiceName?: string
  shippingEstimatedDays?: number
  pixKey?: string
  idempotencyKey?: string
  pointsToRedeem?: number // Pontos a resgatar como desconto
  paymentMethod?: PaymentMethod
  creditCard?: CreditCardData
  installments?: number
  installmentValue?: number
  acceptedFinancialTotal?: number
  paymentGateway?: PaymentGateway
}

export interface CreateOrderResult {
  success: true
  kind?: 'approved' | 'action_required' | 'manual' | 'processing' | 'declined' | 'cancelled' | 'review'
  paymentState?: 'MANUAL' | 'ISSUED' | 'PROCESSING' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'REVIEW'
  financialState?: import('@prisma/client').PaymentAttemptStatus
  order: {
    id: string
    status?: string
    version?: number
    checkoutIntentID?: string
    sourceCartID?: string | null
    sourceCartVersion?: number | null
    serverTime?: string
    allowedActions?: Array<'PAY_PIX' | 'PAY_BOLETO' | 'CONTACT_MANUAL'>
    whatsappNumber?: string | null
    orderAccessToken?: string
    address?: CheckoutAddressData
    orderNumber: number
    paymentState?: string
    financialState?: import('@prisma/client').PaymentAttemptStatus
    paymentExpiresAt?: string | null
    financialTotal?: number
    financingCharge?: number
    total: number
    subtotal: number
    freightValue: number | null
    shippingCost: number
    shippingProvider: string | null
    shippingServiceName: string | null
    shippingEstimatedDays: number | null
    pixKey: string | null
    paymentMethod?: string | null
    asaasPaymentId?: string | null
    pixQrCode?: string | null
    pixPayload?: string | null
    creditCardBrand?: string | null
    creditCardLast4?: string | null
    installments?: number | null
    installmentValue?: number | null
    asaasBankSlipUrl?: string | null
    asaasDigitableLine?: string | null
    asaasBarCode?: string | null
    asaasDueDate?: string | null
    pointsEarned: number
    pointsRedeemed: number
    pointsDiscountValue: number
    customer: { name: string; phone: string; cpfCnpj?: string | null }
    items: Array<{
      productId?: string
      variantId?: string
      name: string
      quantity: number
      price: number
      color?: string
      size?: string
    }>
    deliveryType: string
  }
}


/** Sole public purchase command. The source, proposal and accepted revision are
 * mandatory; no transport key or client total substitutes for consent. */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  if (!params.checkoutIntentID || !Number.isInteger(params.acceptedRevision) || !params.acceptedContentHash) throw new Error('CHECKOUT_INTENT_REQUIRED');
  const outcome = await withCheckoutOwner(params, async (tx, ownerKey, locks) => {
    const intent = await lockOwnedIntent(tx, locks, params, ownerKey, params.checkoutIntentID!);
    const snapshot = intentSnapshot(intent);
    if (intent.revision !== params.acceptedRevision || intent.contentHash !== params.acceptedContentHash) throw new Error('CHECKOUT_RECONFIRM_REQUIRED');
    if (params.items?.length && requestFingerprint(params) !== snapshot.requestHash) throw new Error('CHECKOUT_CONTENT_CONFLICT');
    const placed = await tx.order.findUnique({ where: { checkoutIntentID_lojaID: { checkoutIntentID: intent.id, lojaID: params.lojaID } } });
    if (placed) return { kind: 'replay' as const };
    if (intent.status !== 'OPEN' || intent.expiresAt.getTime() <= (await checkoutNow(tx)).getTime()) throw new Error('CHECKOUT_RECONFIRM_REQUIRED');
    const cart = await lockIntentSource(tx, locks, intent, ownerKey);
    const content = (items: Array<{ productId: string; variantId: string; quantity: number }>) => items
      .map(i => [i.productId, i.variantId, i.quantity]).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1);
    if (cart && checkoutHash(content(cart.items.map(i => ({ productId: i.productID, variantId: i.variantID, quantity: i.quantity })))) !==
      checkoutHash(content(snapshot.input.items.map(i => ({ productId: i.productId!, variantId: i.variantId!, quantity: i.quantity }))))) throw new Error('CHECKOUT_CART_CHANGED');
    const input = { ...snapshot.input, paymentGateway: params.paymentGateway, creditCard: params.creditCard };
    // No writes precede recalculation. A changed catalog/policy/balance requires
    // a newly displayed revision, never silent charging of new terms.
    if (input.paymentMethod === 'CREDIT_CARD' && !creditCardSchema.safeParse(params.creditCard).success) throw new Error('PAYMENT_CARD_BILLING_REQUIRED');
    const prepared = await prepareCheckout(tx, { ...input, acceptedFinancialTotal: undefined, installmentValue: undefined }, true);
    const now = await checkoutNow(tx);
    if (intent.expiresAt.getTime() <= now.getTime()) throw new Error('CHECKOUT_RECONFIRM_REQUIRED');
    if (prepared.hash !== intent.contentHash) {
      await tx.checkoutIntent.update({ where: { id: intent.id }, data: { status: 'REQUIRES_REVIEW' } });
      return { kind: 'review' as const };
    }
    const { buyer: buyerInput, items, subtotal, discount, pointsRedeemed, financial, freight, loja, gateway } = prepared;
    const guest = intent.userID ? null : guestCheckoutAccess(ownerKey, intent.id);
    const addresses = checkoutAddresses(input);
    const buyer = await tx.orderBuyer.create({ data: { lojaID: params.lojaID, authenticatedUserID: intent.userID,
      name: buyerInput.name, email: buyerInput.email, phone: buyerInput.phone, cpfCnpj: prepared.normalized.customer.cpfCnpj,
      deliveryAddress: addresses.shippingAddress ? { ...addresses.shippingAddress } : undefined,
      billingAddress: addresses.billingAddress ? { ...addresses.billingAddress } : undefined,
      recoveryTokenHash: guest?.hash, recoveryExpiresAt: guest ? new Date(now.getTime() + 7 * 86400000) : undefined }, select: buyerSelect });
    await InventoryService.reserveStock(items, tx, params.lojaID);
    const created = await tx.order.create({ data: { lojaID: params.lojaID, userID: intent.userID, buyerID: buyer.id,
      checkoutIntentID: intent.id, sourceCartID: intent.cartID, status: 'PENDING',
      customerCpfCnpj: prepared.normalized.customer.cpfCnpj, paymentMethod: financial.plan.method,
      pixKeyUsed: financial.plan.method === 'WHATSAPP_PIX' ? loja.pixKey : null,
      installments: financial.plan.installments.length, installmentValue: new Prisma.Decimal(financial.plan.installments[0]),
      financialTotal: new Prisma.Decimal(financial.plan.financialTotal), financingCharge: new Prisma.Decimal(financial.plan.financingCharge),
      financialPlan: { ...financial.plan, calculationRule: financial.rule }, loyaltyEarnSnapshot: financial.earn,
      financialSnapshot: { schemaVersion: 1, intentID: intent.id, revision: intent.revision, contentHash: intent.contentHash,
        financialPlan: financial.plan, manualInstructions: prepared.normalized.manualInstructions },
      subtotal, pointsDiscountValue: discount, pointsRedeemed, pointsEarned: financial.earn.points,
      total: new Prisma.Decimal(financial.plan.commercialTotal), shippingCost: freight.amount,
      freightValue: freight.amount.isZero() ? null : freight.amount, freightQuoteId: freight.id,
      freightSnapshot: freight.snapshot, shippingProvider: freight.provider, shippingServiceName: freight.serviceName,
      shippingEstimatedDays: freight.estimatedDays, deliveryType: input.deliveryType,
      // Historical global keys remain readable by authorized order APIs only.
      idempotencyKey: null,
      items: { create: items.map(i => ({ productId: i.productId, productVariantsId: i.variantId, quantity: i.quantity,
        name: i.name, price: i.price, color: i.color, size: i.size })) } }, include: { items: true } });
    for (const item of created.items) await tx.inventoryReservation.create({ data: { orderId: created.id, orderItemId: item.id,
      productId: item.productId!, variantId: item.productVariantsId, quantity: item.quantity, status: 'RESERVED' } });
    if (pointsRedeemed && intent.userID) await debitRedeemedPoints({ lojaID: params.lojaID, userID: intent.userID,
      orderId: created.id, points: pointsRedeemed, monetaryValue: Number(discount), description: 'Desconto da intenção aceita' }, tx);
    const attempt = await tx.paymentAttempt.create({ data: { orderId: created.id, number: 1,
      provider: financial.plan.method === 'WHATSAPP_PIX' ? 'MANUAL' : 'ASAAS', method: financial.plan.method,
      providerAccount: financial.plan.method === 'WHATSAPP_PIX' ? null : paymentAccountScope(),
      status: financial.plan.method === 'WHATSAPP_PIX' ? 'NOT_STARTED' : 'SUBMITTING', externalReference: created.id,
      financialTotal: new Prisma.Decimal(financial.plan.financialTotal), installments: financial.plan.installments.length,
      planSnapshot: { ...financial.plan, calculationRule: financial.rule, expiryPolicy: prepared.normalized.expiryPolicy },
      reservationExpiresAt: financial.plan.method === 'WHATSAPP_PIX' ? new Date(now.getTime() + 24 * 3600000) : null,
      reviewAfter: new Date(now.getTime() + 24 * 3600000),
      reconcileAfter: new Date(now.getTime() + 120000), submittedAt: financial.plan.method === 'WHATSAPP_PIX' ? null : now } });
    if (intent.cartID) await tx.cart.update({ where: { id: intent.cartID }, data: { status: 'COMPLETED', version: { increment: 1 } } });
    else await tx.checkoutBasket.update({ where: { id: intent.basketID! }, data: { status: 'COMPLETED' } });
    await tx.checkoutIntent.update({ where: { id: intent.id }, data: { status: 'PROCESSING', acceptedAt: now, buyerID: buyer.id } });
    const effectKey = 'checkout:' + intent.id;
    await tx.auditLog.create({ data: { actorType: intent.userID ? 'USER' : 'SYSTEM', actorId: intent.userID,
      systemActor: intent.userID ? null : 'GUEST_CHECKOUT', entity: 'Order', entityId: created.id,
      action: 'CHECKOUT_COMMITTED', effectKey, metadata: { intentID: intent.id, revision: intent.revision,
        contentHash: intent.contentHash, cartID: intent.cartID, cartVersion: intent.cartVersion, basketID: intent.basketID } } });
    await tx.commerceOutbox.create({ data: { effectKey, commandType: 'CHECKOUT_COMMITTED', aggregateId: created.id,
      payload: { schemaVersion: 1, lojaID: params.lojaID, orderId: created.id, intentID: intent.id } } });
    return { kind: 'created' as const, created, attempt, financial, gateway, input };
  });
  if (outcome.kind === 'review') throw new Error('CHECKOUT_RECONFIRM_REQUIRED');
  if (outcome.kind === 'created' && outcome.financial.plan.method !== 'WHATSAPP_PIX') await executePaymentAttempt({
    orderId: outcome.created.id, orderNumber: outcome.created.orderNumber, lojaID: params.lojaID, attemptId: outcome.attempt.id,
    plan: outcome.financial.plan, gateway: outcome.gateway, creditCard: params.creditCard,
    customer: { ...outcome.input.customer, cpfCnpj: outcome.input.customer.cpfCnpj!,
      postalCode: checkoutAddresses(outcome.input).billingAddress?.cep,
      addressNumber: checkoutAddresses(outcome.input).billingAddress?.number,
      addressComplement: checkoutAddresses(outcome.input).billingAddress?.complement } });
  // Both first response and replay use the same current persisted result.
  const recovered = await recoverCheckout(params, params.checkoutIntentID);
  if (!recovered.result) throw new Error('CHECKOUT_RESULT_UNAVAILABLE');
  return recovered.result;
}

export async function recoverCheckout(scope: CheckoutScope, intentID: string) {
  return withCheckoutOwner(scope, async (tx, ownerKey, locks) => {
    const intent = await lockOwnedIntent(tx, locks, scope, ownerKey, intentID);
    const proposal = proposalDTO(intent, await checkoutNow(tx));
    const order = await tx.order.findUnique({ where: { checkoutIntentID_lojaID: { checkoutIntentID: intentID, lojaID: scope.lojaID } }, include: purchaseInclude });
    if (!order) return { ...proposal, result: null };
    if (order.lojaID !== scope.lojaID || order.userID !== intent.userID || (intent.userID && intent.userID !== scope.customer.userId)) throw new Error('CHECKOUT_INTENT_NOT_FOUND');
    const now = await checkoutNow(tx);
    const access = !intent.userID && order.buyer?.recoveryExpiresAt && order.buyer.recoveryExpiresAt.getTime() > now.getTime()
      ? guestCheckoutAccess(ownerKey, intentID) : null;
    return { ...proposal, result: purchaseResultFromOrder(order, access?.hash === order.buyer?.recoveryTokenHash ? access?.token : undefined, now) };
  });
}
