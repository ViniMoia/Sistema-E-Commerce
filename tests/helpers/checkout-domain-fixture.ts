import { vi } from 'vitest';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { checkoutHash } from '@/lib/commerce/checkout-content';
import type { CreateOrderParams } from '@/services/checkout.service';
let plan: Awaited<ReturnType<typeof import('@/services/checkout-plan.service').prepareCheckout>> | undefined;
let intent: Record<string, any>;
/** These older unit suites isolate catalog, buyer, loyalty and adapter behavior.
 * Intention/source authorization is explicitly mocked here and is covered by
 * the separate real-DB concurrency/authorization suite. No runtime bypass. */
export async function intentUnitMock(actual: typeof import('@/services/checkout-intent.service')) {
  return { ...actual, checkoutNow: async () => new Date(),
    withCheckoutOwner: async (params: CreateOrderParams, work: any) => work(prisma, params.customer.userId ? 'u:' + params.customer.userId : 'g:' + 'a'.repeat(64), {}),
    lockOwnedIntent: async () => intent, lockIntentSource: async () => null,
  };
}
export async function planUnitMock(actual: typeof import('@/services/checkout-plan.service')) {
  return { ...actual, prepareCheckout: (...args: Parameters<typeof actual.prepareCheckout>) => plan ?? actual.prepareCheckout(...args) };
}
export async function createOrder(params: CreateOrderParams) {
  const db = prisma as any;
  if (params.customer.userId) {
    const user = await db.user.findUnique({ where: { id: params.customer.userId } });
    if (!user || user.lojaID !== params.lojaID || user.status !== 'ACTIVE') throw new Error('Usuário inválido ou não pertence a esta loja.');
    if (user.email?.toLowerCase().trim() !== params.customer.email.toLowerCase().trim()) throw new Error('Identificador de usuário não corresponde ao e-mail informado.');
  }
  const actualPlan = await vi.importActual<typeof import('@/services/checkout-plan.service')>('@/services/checkout-plan.service');
  plan = await actualPlan.prepareCheckout(db, params);
  const actualIntent = await vi.importActual<typeof import('@/services/checkout-intent.service')>('@/services/checkout-intent.service');
  intent = { id: 'fixture-intent', lojaID: params.lojaID, userID: params.customer.userId ?? null, cartID: null,
    basketID: 'fixture-basket', revision: 1, protocolVersion: 1, contentHash: checkoutHash(plan.normalized),
    snapshot: { schemaVersion: 1, input: params, requestHash: actualIntent.requestFingerprint(params), proposal: plan.normalized },
    status: 'OPEN', expiresAt: new Date(Date.now() + 60000), ownerKey: params.customer.userId ? 'u:' + params.customer.userId : 'g:' + 'a'.repeat(64) };
  db.checkoutIntent = { update: vi.fn(async () => intent) };
  db.checkoutBasket = { update: vi.fn() }; db.inventoryReservation = { create: vi.fn() };
  db.auditLog ??= { create: vi.fn() }; db.commerceOutbox ??= { create: vi.fn() };
  db.productVariants.findUnique ??= vi.fn(async ({ where }: any) => ({ ProductID: plan!.items.find(i => i.variantId === where.id)?.productId, retiredAt: null }));
  const originalCreate = db.order.create, originalFind = db.order.findUnique, originalUpdate = db.order.update;
  const attemptCreate = db.paymentAttempt.create, attemptUpdate = db.paymentAttempt.update, chargeCreate = db.paymentCharge?.createMany;
  let stored: any = null, attempt: any = null;
  db.order.create = vi.fn(async (args: any) => {
    const result = await originalCreate(args);
    stored = { ...args.data, ...result, version: 0, status: 'PENDING', asaasPaymentId: null, asaasDueDate: null, installmentValue: args.data.installmentValue,
      asaasBankSlipUrl: null, asaasDigitableLine: null, asaasBarCode: null, creditCardBrand: null, creditCardLast4: null,
      buyer: { ...plan!.buyer, cpfCnpj: plan!.normalized.customer.cpfCnpj, recoveryExpiresAt: new Date(Date.now() + 86400000), deliveryAddress: args.data.deliveryType === 'DELIVERY' ? params.address : null },
      items: args.data.items.create.map((i: any, index: number) => ({ ...i, id: 'unit-item-' + index, price: new Prisma.Decimal(i.price) })), paymentAttempts: [] };
    return stored;
  });
  db.order.findUnique = vi.fn(async () => stored);
  db.order.update = vi.fn(async ({ data }: any) => { Object.assign(stored, data); return stored; });
  db.paymentAttempt.create = vi.fn(async (args: any) => { attempt = { ...await attemptCreate(args), charges: [] }; stored.paymentAttempts = [attempt]; return attempt; });
  db.paymentAttempt.update = vi.fn(async (args: any) => { await attemptUpdate(args); Object.assign(attempt, args.data); return attempt; });
  db.paymentCharge ??= {};
  db.paymentCharge.createMany = vi.fn(async (args: any) => { if (chargeCreate) await chargeCreate(args); attempt.charges = args.data; });
  try {
    const { createOrder: complete } = await import('@/services/checkout.service');
    return await complete({ ...params, checkoutIntentID: intent.id, acceptedRevision: 1, acceptedContentHash: intent.contentHash });
  } finally {
    plan = undefined; db.order.create = originalCreate; db.order.findUnique = originalFind; db.order.update = originalUpdate;
    db.paymentAttempt.create = attemptCreate; db.paymentAttempt.update = attemptUpdate;
    db.paymentCharge.createMany = chargeCreate;
  }
}
