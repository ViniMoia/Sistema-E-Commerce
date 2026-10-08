import { randomUUID, randomBytes } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createOrder, type CreateOrderParams } from '@/tests/setup/checkout-fixture';
import { receivePaymentEvent } from '@/services/payment/payment-inbox.service';
import { drainPaymentInbox, reconcilePaymentAttempts } from '@/services/payment/payment-worker.service';
import { drainPaymentOutbox } from '@/services/payment/payment-outbox.service';
import { requestPaymentOperation } from '@/services/payment/payment-operations.service';
import { manualRefund } from '@/services/payment/manual-refund.service';
import { requestPaymentReconciliation } from '@/services/payment/payment-supervision.service';
import { applyPaymentEvidence } from '@/services/payment/payment-evidence.service';
import { AsaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
import { asaasClient } from '@/services/asaas/asaas.client';
import type { AsaasPaymentResponse } from '@/types/asaas.types';
import { CommerceLocks } from '@/lib/commerce/locks';
import { processExpiredOrders } from '@/services/order-timeout.service';
import { transitionOrder } from '@/lib/commerce/order-command';
import { claimWork, completeWork } from '@/services/payment/durable-work.service';
import { post, get } from '@/tests/helpers/request';
import type { PaymentGateway, PaymentMethod, RemoteCharge } from '@/types/payment-gateway.types';
let lojaID: string, adminID: string, host: string;
const inboxIds = new Set<string>();
const approvalLatency = new AsyncLocalStorage<{ delayed: boolean }>();
beforeAll(async () => {
  await verifyTestDatabase(); lojaID = await createFixtureStore();
  prisma.$use(async (params, next) => {
    const latency = approvalLatency.getStore();
    if (latency && !latency.delayed && params.runInTransaction && params.model === 'Order' && params.action === 'findUnique') {
      latency.delayed = true;
      // Simulate a slow DB round trip at the commercial approval boundary.
      // Real Prisma/PostgreSQL must keep the transaction alive beyond 5s.
      await new Promise(resolve => setTimeout(resolve, 5500));
    }
    return next(params);
  });
  await prisma.loja.update({ where: { id: lojaID }, data: { enablePix: true, enableBoleto: true, enableCreditCard: true, enablePickup: true } });
  adminID = (await prisma.user.create({ data: { lojaID, name: 'Admin', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } })).id;
  host = (await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug + '.plataforma.com';
});
afterAll(async () => {
  await prisma.paymentInbox.deleteMany({ where: { id: { in: [...inboxIds] } } });
  await cleanupFixtureStores(); await prisma.$disconnect();
});
function port() {
  const remote: RemoteCharge[] = [];
  const gateway: PaymentGateway = {
    capabilities: vi.fn(async () => ({ configured: true, methods: ['PIX', 'BOLETO', 'CREDIT_CARD'] as PaymentMethod[], maximumInstallments: 3 })),
    createPixCharge: vi.fn(async input => {
      const row: RemoteCharge = { paymentId: randomUUID(), externalReference: input.orderId, method: 'PIX', ordinal: 1, value: input.value, status: 'PENDING',
        instructions: { pixPayload: 'fixture-copy', pixQrCodeBase64: 'fixture-qr', expiresAt: '2030-10-05T12:00:00Z' } };
      remote.push(row); return { ...row, pixPayload: 'fixture-copy', pixQrCodeBase64: 'fixture-qr', expirationDate: row.instructions!.expiresAt };
    }),
    createBoletoCharge: vi.fn(async input => {
      remote.push({ paymentId: randomUUID(), externalReference: input.orderId, method: 'BOLETO', ordinal: 1, value: input.value, status: 'PENDING', dueAt: '2030-10-06T03:00:00Z',
        instructions: { bankSlipUrl: 'https://example.invalid/boleto', digitableLine: '1234' } });
      return { ...remote[0], bankSlipUrl: 'https://example.invalid/boleto', digitableLine: '1234', dueDate: '2030-10-05' };
    }),
    createCreditCardCharge: vi.fn(async input => {
      const contractId = randomUUID(); const values = (input.installmentCount ?? 1) === 3 ? [33.33, 33.33, 33.34] : [input.value];
      for (const [index, value] of values.entries()) remote.push({ paymentId: randomUUID(), externalReference: input.orderId, method: 'CREDIT_CARD', ordinal: index + 1, value, status: 'PENDING', contractId });
      return { ...remote[0], value: input.value, contractId, charges: remote, approvedForEntireContract: false };
    }),
    inspectAttempt: vi.fn(async () => ({ complete: true, charges: structuredClone(remote) })),
    cancelPayment: vi.fn(async id => { remote.find(r => r.paymentId === id)!.deleted = true; }),
    refundPayment: vi.fn(async id => { remote.find(r => r.paymentId === id)!.status = 'REFUNDED'; }),
    getPaymentStatus: vi.fn(async () => { throw new Error('unused'); }),
  };
  return { gateway, remote };
}
async function purchase(p = port(), method: PaymentMethod = 'PIX', userId?: string) {
  const buyer = userId ? await prisma.user.findUniqueOrThrow({ where: { id: userId } }) : null;
  const product = await prisma.product.create({ data: { lojaID, userID: adminID, name: 'Produto financeiro', description: '', imageUrl: '', price: 100, stock: 5,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 5 } } }, include: { productVariants: true } });
  const input: CreateOrderParams = { lojaID, customer: { userId, name: 'Comprador', email: buyer?.email ?? randomUUID() + '@example.invalid', phone: '11999999999', cpfCnpj: '52998224725' },
    items: [{ productId: product.id, variantId: product.productVariants[0].id, quantity: 1 }], deliveryType: 'PICKUP', paymentMethod: method,
    freightOwnerKey: 'g:' + randomBytes(32).toString('hex'), paymentGateway: p.gateway,
    ...(method === 'BOLETO' || method === 'CREDIT_CARD' ? { address: { cep: '01001000', state: 'SP', city: 'São Paulo', street: 'Rua', neighborhood: 'Centro', number: '1' } } : {}),
    ...(method === 'CREDIT_CARD' ? { installments: 3, acceptedFinancialTotal: 100, creditCard: { holderName: 'FIXTURE', number: '4532015112830366', expiryMonth: '12', expiryYear: '2030', ccv: '123' } } : {}) };
  if (method === 'CREDIT_CARD') { vi.stubEnv('INSTALLMENT_MONTHLY_RATE', '0'); vi.stubEnv('INSTALLMENT_ABSORB_FEES', 'false'); }
  const result = await createOrder(input);
  vi.unstubAllEnvs();
  const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: result.order.id } });
  return { ...p, input, result, attempt, product };
}
async function stored(orderId: string) { return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { paymentAttempts: { include: { charges: true, operations: true } }, reservations: true } }); }
async function due(id: string) { await prisma.paymentAttempt.update({ where: { id }, data: { reconcileAfter: new Date(0) } }); }
async function event(p: Awaited<ReturnType<typeof purchase>>, type = 'PAYMENT_RECEIVED', extras: object = {}) {
  const payload = { id: randomUUID(), event: type, payment: { id: p.remote[0].paymentId, externalReference: p.result.order.id, billingType: p.remote[0].method,
    value: p.remote[0].value, status: p.remote[0].status, ...extras } };
  const accepted = await receivePaymentEvent(payload);
  const row = await prisma.paymentInbox.findFirstOrThrow({ where: { eventId: accepted.eventId } }); inboxIds.add(row.id);
  return { row, payload };
}
async function stock(p: Awaited<ReturnType<typeof purchase>>) { return (await prisma.product.findUniqueOrThrow({ where: { id: p.product.id } })).stock; }

describe('WF-14: real PostgreSQL, controlled remote operations, resumable executor', () => {
  it.each(['inbox', 'reconciliation'] as const)('slow DB approval through %s stays atomic and replay creates no duplicate effects', async consumer => {
    const config = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } });
    await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: true, loyaltyEarnRate: 1 } });
    try {
      const buyer = await prisma.user.create({ data: { lojaID, name: 'Comprador', email: randomUUID() + '@example.invalid', password: '' } });
      const p = await purchase(port(), 'PIX', buyer.id);
      p.remote[0].status = 'RECEIVED';
      const e = await event(p);
      await due(p.attempt.id);
      const latency = { delayed: false };
      const result = await approvalLatency.run(latency, () => consumer === 'inbox'
        ? drainPaymentInbox(50, p.gateway) : reconcilePaymentAttempts(50, p.gateway));
      expect(latency.delayed).toBe(true);
      expect(result).toMatchObject({ retried: 0, review: 0 });
      const order = await stored(p.result.order.id);
      expect(order).toMatchObject({ status: 'PAID', version: 1, pointsCredited: 100,
        reservations: [{ status: 'COMMITTED' }], paymentAttempts: [{ status: 'APPROVED' }] });
      // Replay both entry points against the same provider receipt.
      await due(p.attempt.id);
      await reconcilePaymentAttempts(50, p.gateway);
      await drainPaymentInbox(50, p.gateway);
      expect((await prisma.paymentInbox.findUniqueOrThrow({ where: { id: e.row.id } })).status).toBe('COMPLETED');
      expect((await stored(order.id)).version).toBe(1);
      expect(await prisma.financialFact.count({ where: { orderId: order.id } })).toBe(2);
      expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id } })).toBe(1);
      expect(await prisma.loyaltyTransaction.count({ where: { orderId: order.id, type: 'EARN' } })).toBe(1);
      expect(await prisma.commerceOutbox.count({ where: { effectKey: 'payment-confirmation:' + order.id } })).toBe(1);
      expect(await stock(p)).toBe(4);
      expect(p.gateway.createPixCharge).toHaveBeenCalledTimes(1);
    } finally {
      await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: config.loyaltyEnabled, loyaltyEarnRate: config.loyaltyEarnRate } });
    }
  });

  it.each([false, true])('real adapter persists/replays PIX with nullable installment metadata; lost response=%s', async lostResponse => {
    const p = port(), adapter = new AsaasPaymentAdapter();
    let remotePayment: AsaasPaymentResponse | undefined;
    const customer = vi.spyOn(asaasClient, 'getOrCreateCustomer').mockResolvedValue('cus-fixture');
    const submit = vi.spyOn(asaasClient, 'createPayment').mockImplementation(async input => {
      remotePayment = { id: randomUUID(), customer: 'cus-fixture', externalReference: input.externalReference,
        billingType: 'PIX', status: 'PENDING', value: input.value!, netValue: input.value!, dateCreated: '2026-10-08',
        dueDate: input.dueDate, installment: null, installmentNumber: null };
      return remotePayment;
    });
    const qr = vi.spyOn(asaasClient, 'getPixQrCode').mockResolvedValue({ payload: 'fixture-copy', encodedImage: 'fixture-qr', expirationDate: '2030-10-05T12:00:00Z' });
    const lookup = vi.spyOn(asaasClient, 'listPaymentsByReference').mockImplementation(async reference => {
      expect(reference).toBe(remotePayment?.externalReference);
      return remotePayment ? [remotePayment] : [];
    });
    p.gateway.createPixCharge = vi.fn(async input => {
      const result = await adapter.createPixCharge(input);
      if (lostResponse) throw new Error('Controlled response loss after issuance');
      return result;
    });
    p.gateway.inspectAttempt = adapter.inspectAttempt.bind(adapter);
    try {
      const order = await purchase(p);
      expect(order.result.paymentState).toBe(lostResponse ? 'PROCESSING' : 'ISSUED');
      if (lostResponse) {
        await due(order.attempt.id);
        expect(await reconcilePaymentAttempts(50, p.gateway)).toMatchObject({ completed: 1, retried: 0, review: 0 });
      }
      const replay = await createOrder(order.input);
      expect(replay).toMatchObject({ paymentState: 'ISSUED', order: { id: order.result.order.id,
        pixPayload: 'fixture-copy', pixQrCode: 'fixture-qr', allowedActions: ['PAY_PIX'] } });
      expect(submit).toHaveBeenCalledTimes(1);
      expect((await stored(order.result.order.id)).paymentAttempts[0]).toMatchObject({ status: 'PENDING',
        charges: [{ providerPaymentId: remotePayment!.id, instructions: { pixPayload: 'fixture-copy', pixQrCodeBase64: 'fixture-qr' } }] });
      expect(await stock(order)).toBe(4);
    } finally {
      customer.mockRestore(); submit.mockRestore(); qr.mockRestore(); lookup.mockRestore();
    }
  });

  it('lost creation response is looked up without a second charge; QR is recovered', async () => {
    const p = port(), original = vi.mocked(p.gateway.createPixCharge).getMockImplementation()!;
    vi.mocked(p.gateway.createPixCharge).mockImplementationOnce(async args => { await original(args); throw new Error('lost response'); });
    const order = await purchase(p); expect(order.result.kind).toBe('processing');
    await due(order.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    const result = await stored(order.result.order.id);
    expect(result.paymentAttempts[0]).toMatchObject({ status: 'PENDING', charges: [{ instructions: { pixPayload: 'fixture-copy' } }] });
    expect(p.gateway.createPixCharge).toHaveBeenCalledTimes(1); expect(await stock(order)).toBe(4);
  });
  it('empty reference lookup retains UNKNOWN and reservation, never declines or reissues', async () => {
    const p = port(); vi.mocked(p.gateway.createPixCharge).mockRejectedValueOnce(new Error('transport unknown'));
    const order = await purchase(p); await due(order.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect((await stored(order.result.order.id)).paymentAttempts[0].status).toBe('UNKNOWN'); expect(await stock(order)).toBe(4);
    expect(p.gateway.createPixCharge).toHaveBeenCalledTimes(1);
  });
  it('concurrent duplicate delivery is one inbox row, without immediate effects', async () => {
    const p = await purchase(); const e = await event(p); await Promise.all([receivePaymentEvent(e.payload), receivePaymentEvent(e.payload)]);
    expect(await prisma.paymentInbox.count({ where: { eventId: e.payload.id } })).toBe(1);
    expect((await stored(p.result.order.id)).status).toBe('PENDING');
  });
  it('fallback event identity is deterministic and sensitive attributes are stripped', async () => {
    const p = await purchase(); const e = await event(p); const raw = { ...e.payload, id: undefined, payment: { ...e.payload.payment, creditCard: { number: 'DO_NOT_STORE', ccv: 'NO_CVV', creditCardToken: 'NO_TOKEN' } } };
    const a = await receivePaymentEvent(raw), b = await receivePaymentEvent(raw); expect(a.eventId).toBe(b.eventId);
    const row = await prisma.paymentInbox.findFirstOrThrow({ where: { eventId: a.eventId } }); inboxIds.add(row.id);
    expect(JSON.stringify(row.payload)).not.toMatch(/DO_NOT_STORE|NO_CVV|NO_TOKEN/);
  });
  it('reused event ID with different financial content is rejected', async () => {
    const p = await purchase(), e = await event(p);
    await expect(receivePaymentEvent({ ...e.payload, payment: { ...e.payload.payment, value: 101 } })).rejects.toThrow('WEBHOOK_EVENT_ID_CONTENT_CONFLICT');
  });
  it('two consumers create one commercial approval and unique facts/notification', async () => {
    const p = await purchase(); p.remote[0].status = 'RECEIVED'; await event(p);
    await Promise.all([drainPaymentInbox(50, p.gateway), drainPaymentInbox(50, p.gateway)]);
    const order = await stored(p.result.order.id); expect(order.status).toBe('PAID'); expect(order.version).toBe(1);
    expect(order.reservations[0].status).toBe('COMMITTED');
    expect(await prisma.financialFact.count({ where: { orderId: order.id } })).toBe(2);
    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.commerceOutbox.count({ where: { effectKey: 'payment-confirmation:' + order.id } })).toBe(1);
  });
  it('a dead consumer lease is reclaimable while an old owner cannot acknowledge it', async () => {
    const p = await purchase(), e = await event(p); const old = await claimWork('PaymentInbox', 50);
    expect(old.ids).toContain(e.row.id);
    await prisma.paymentInbox.update({ where: { id: e.row.id }, data: { leaseExpiresAt: new Date(0) } });
    const next = await claimWork('PaymentInbox', 50); expect(next.ids).toContain(e.row.id); expect(next.owner).not.toBe(old.owner);
    await expect(prisma.$transaction(tx => completeWork(tx, 'PaymentInbox', e.row.id, old.owner))).rejects.toThrow('DURABLE_WORK_LEASE_LOST');
    await prisma.paymentInbox.update({ where: { id: e.row.id }, data: { leaseExpiresAt: new Date(0) } });
  });
  it('unavailable provider leaves received work retryable and payment unmodified', async () => {
    const p = await purchase(), e = await event(p); vi.mocked(p.gateway.inspectAttempt!).mockRejectedValue(new Error('timeout'));
    await drainPaymentInbox(50, p.gateway); const work = await prisma.paymentInbox.findUniqueOrThrow({ where: { id: e.row.id } });
    expect(work.status).toBe('READY'); expect(work.lastErrorCode).toBe('PAYMENT_EVENT_RETRY'); expect((await stored(p.result.order.id)).status).toBe('PENDING');
  });
  it('late pending notification cannot regress approved payment or duplicate effects', async () => {
    const p = await purchase(); p.remote[0].status = 'RECEIVED'; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    p.remote[0].status = 'PENDING'; await event(p, 'PAYMENT_UPDATED'); await drainPaymentInbox(50, p.gateway);
    const order = await stored(p.result.order.id); expect(order.status).toBe('PAID'); expect(order.paymentAttempts[0].status).toBe('APPROVED');
    expect(order.paymentAttempts[0].charges[0].providerStatus).toBe('RECEIVED'); expect(order.version).toBe(1);
  });
  it('mismatched amount creates review without financial or stock effects', async () => {
    const p = await purchase(); p.remote[0].value = 99; p.remote[0].status = 'RECEIVED'; const e = await event(p);
    await drainPaymentInbox(50, p.gateway); expect((await stored(p.result.order.id)).status).toBe('PENDING');
    expect(await prisma.financialFact.count({ where: { orderId: p.result.order.id } })).toBe(0); expect(await stock(p)).toBe(4);
    expect((await prisma.paymentInbox.findUniqueOrThrow({ where: { id: e.row.id } })).status).toBe('DEAD_LETTER');
  });
  it('conflicting payment ID and another order reference are quarantined', async () => {
    const a = await purchase(), b = await purchase(); const e = await event(a, 'PAYMENT_RECEIVED', { externalReference: b.result.order.id });
    await drainPaymentInbox(50, a.gateway); expect((await stored(a.result.order.id)).status).toBe('PENDING'); expect((await stored(b.result.order.id)).status).toBe('PENDING');
    expect((await prisma.paymentInbox.findUniqueOrThrow({ where: { id: e.row.id } })).status).toBe('DEAD_LETTER');
  });
  it('extra charge/duplicate contract enters review without choosing a convenient first result', async () => {
    const p = await purchase(); p.remote.push({ ...p.remote[0], paymentId: randomUUID() }); await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect((await stored(p.result.order.id)).paymentAttempts[0].failureCode).toBe('PAYMENT_CONTRACT_MISMATCH'); expect(await stock(p)).toBe(4);
  });
  it('first card installment alone does not approve; the full contract can approve once', async () => {
    const p = await purchase(port(), 'CREDIT_CARD'); p.remote[0].status = 'CONFIRMED'; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect((await stored(p.result.order.id)).status).toBe('PENDING');
    p.remote.forEach(r => { r.status = 'CONFIRMED'; }); await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect((await stored(p.result.order.id)).status).toBe('PAID'); expect(await prisma.financialFact.count({ where: { orderId: p.result.order.id, type: 'AUTHORIZED' } })).toBe(3);
  });
  it('failure before commercial commit rolls facts, reservations and inbox acknowledgement back', async () => {
    const p = await purchase(); p.remote[0].status = 'RECEIVED'; const e = await event(p); const check = 'wf14_' + randomUUID().replaceAll('-', '');
    await prisma.$executeRawUnsafe(`ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "${check}" CHECK ("orderId"<>'${p.result.order.id}') NOT VALID`);
    try {
      await drainPaymentInbox(50, p.gateway); const order = await stored(p.result.order.id); expect(order.status).toBe('PENDING'); expect(order.reservations[0].status).toBe('RESERVED');
      expect(await prisma.financialFact.count({ where: { orderId: order.id } })).toBe(0);
      expect((await prisma.paymentInbox.findUniqueOrThrow({ where: { id: e.row.id } })).status).toBe('READY');
    } finally { await prisma.$executeRawUnsafe(`ALTER TABLE "OrderStatusHistory" DROP CONSTRAINT "${check}"`); }
    await prisma.paymentInbox.update({ where: { id: e.row.id }, data: { nextAttemptAt: new Date(0) } }); await drainPaymentInbox(50, p.gateway);
    expect((await stored(p.result.order.id)).status).toBe('PAID'); expect(p.gateway.createPixCharge).toHaveBeenCalledTimes(1);
  });
  it('cancel command has identity, rejects another command/actor and awaits remote proof', async () => {
    const p = await purchase(); const command = { orderId: p.result.order.id, lojaID, userId: adminID, kind: 'CANCEL' as const, commandId: randomUUID(), expectedVersion: 0 };
    await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { reviewAfter: new Date(0) } });
    const first = await requestPaymentOperation(command), replay = await requestPaymentOperation(command);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: p.attempt.id } })).reviewAfter!.getTime()).toBeGreaterThan(Date.now());
    expect(first.operations[0].id).toBe(replay.operations[0].id); expect(await stock(p)).toBe(4);
    await expect(requestPaymentOperation({ ...command, commandId: randomUUID() })).rejects.toThrow('PAYMENT_OPERATION_CONFLICT');
    await expect(requestPaymentOperation({ ...command, userId: randomUUID() })).rejects.toThrow('PAYMENT_OPERATION_FORBIDDEN');
    await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway); const order = await stored(p.result.order.id);
    expect(order.status).toBe('CANCELLED'); expect(order.paymentAttempts[0].operations[0].status).toBe('COMPLETED'); expect(await stock(p)).toBe(5);
    await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway); expect(p.gateway.cancelPayment).toHaveBeenCalledTimes(1);
  });
  it('uncertain cancellation is queried on resume, never resent or prematurely released', async () => {
    const p = await purchase(); vi.mocked(p.gateway.cancelPayment!).mockRejectedValueOnce(new Error('unknown DELETE result'));
    await requestPaymentOperation({ orderId: p.result.order.id, lojaID, userId: adminID, kind: 'CANCEL', commandId: randomUUID(), expectedVersion: 0 });
    await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway); expect(await stock(p)).toBe(4);
    expect((await stored(p.result.order.id)).paymentAttempts[0].operations[0].status).toBe('UNKNOWN');
    p.remote[0].deleted = true; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect(await stock(p)).toBe(5); expect(p.gateway.cancelPayment).toHaveBeenCalledTimes(1);
  });
  it('approval racing cancellation suppresses remote deletion and preserves committed stock', async () => {
    const p = await purchase(); await requestPaymentOperation({ orderId: p.result.order.id, lojaID, userId: adminID, kind: 'CANCEL', commandId: randomUUID(), expectedVersion: 0 });
    p.remote[0].status = 'RECEIVED'; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect((await stored(p.result.order.id)).status).toBe('PAID'); expect(p.gateway.cancelPayment).not.toHaveBeenCalled(); expect(await stock(p)).toBe(4);
  });
  it('full refund of unshipped order returns inventory once with persisted refund facts', async () => {
    const p = await purchase(); p.remote[0].status = 'RECEIVED'; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { reviewAfter: new Date(0) } });
    await requestPaymentOperation({ orderId: p.result.order.id, lojaID, userId: adminID, kind: 'REFUND', commandId: randomUUID(), expectedVersion: 1 });
    await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect((await stored(p.result.order.id)).status).toBe('CANCELLED'); expect(await stock(p)).toBe(5);
    expect(await prisma.financialFact.count({ where: { orderId: p.result.order.id, type: 'REFUNDED' } })).toBe(1); expect(p.gateway.refundPayment).toHaveBeenCalledTimes(1);
  });
  it('refund of delivered order records finance without returning physical stock', async () => {
    const p = await purchase(); p.remote[0].status = 'RECEIVED'; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect((await transitionOrder({ orderId: p.result.order.id, lojaID, newStatus: 'DELIVERED', performedById: adminID })).success).toBe(true);
    await requestPaymentOperation({ orderId: p.result.order.id, lojaID, userId: adminID, kind: 'REFUND', commandId: randomUUID(), expectedVersion: 2 });
    await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    const order = await stored(p.result.order.id); expect(order.status).toBe('DELIVERED'); expect(order.paymentAttempts[0].status).toBe('REFUNDED');
    expect(order.paymentAttempts[0].failureCode).toBe('PHYSICAL_RETURN_REQUIRED'); expect(await stock(p)).toBe(4);
  });
  it('late payment after cancellation produces facts/review, never reopens or takes stock again', async () => {
    const p = await purchase(); p.remote[0].deleted = true; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway); expect(await stock(p)).toBe(5);
    p.remote[0].deleted = false; p.remote[0].status = 'RECEIVED'; await event(p); await drainPaymentInbox(50, p.gateway);
    const order = await stored(p.result.order.id); expect(order.status).toBe('CANCELLED'); expect(order.paymentAttempts[0].failureCode).toBe('LATE_PAYMENT'); expect(await stock(p)).toBe(5);
    expect(await prisma.financialFact.count({ where: { orderId: order.id, type: 'SETTLED' } })).toBe(1);
  });
  it('valid boleto after one hour and card risk analysis do not expire under PIX rules', async () => {
    const boleto = await purchase(port(), 'BOLETO'), card = await purchase(port(), 'CREDIT_CARD');
    await prisma.order.updateMany({ where: { id: { in: [boleto.result.order.id, card.result.order.id] } }, data: { createdAt: new Date(0) } });
    await processExpiredOrders({ lojaID, gateway: boleto.gateway, now: new Date('2040-01-01'), asaasTimeoutMinutes: 1 });
    expect((await stored(boleto.result.order.id)).status).toBe('PENDING'); expect((await stored(card.result.order.id)).status).toBe('PENDING');
  });
  it('manual expiry rechecks the actual status and two jobs release only once', async () => {
    const p = await purchase(port(), 'WHATSAPP_PIX'); await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { reservationExpiresAt: new Date(0) } });
    const summaries = await Promise.all([processExpiredOrders({ lojaID }), processExpiredOrders({ lojaID })]);
    expect(summaries.reduce((sum, s) => sum + s.cancelledCount, 0)).toBe(1); expect(await stock(p)).toBe(5);
    const paid = await purchase(port(), 'WHATSAPP_PIX'); await prisma.paymentAttempt.update({ where: { id: paid.attempt.id }, data: { reservationExpiresAt: new Date(0) } });
    await transitionOrder({ orderId: paid.result.order.id, lojaID, newStatus: 'PAID', performedById: adminID }); await processExpiredOrders({ lojaID });
    expect((await stored(paid.result.order.id)).status).toBe('PAID'); expect(await stock(paid)).toBe(4);
  });
  it('remote expiry queues cancellation while holding stock until the provider proves deletion', async () => {
    const p = await purchase(); p.remote[0].instructions!.expiresAt = new Date(0).toISOString();
    await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { reservationExpiresAt: new Date(0), externalExpiresAt: new Date(0), reviewAfter: new Date(0) } });
    await processExpiredOrders({ lojaID, gateway: p.gateway }); expect(await stock(p)).toBe(4);
    expect((await stored(p.result.order.id)).paymentAttempts[0].status).toBe('CANCEL_PENDING');
    await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway); expect(await stock(p)).toBe(5);
  });
  it('unavailable provider at expiry and dry run preserve the entire order', async () => {
    const p = await purchase(); await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { reservationExpiresAt: new Date(0), externalExpiresAt: new Date(0) } });
    const before = await stored(p.result.order.id); await processExpiredOrders({ lojaID, dryRun: true, gateway: p.gateway }); expect(await stored(p.result.order.id)).toEqual(before);
    vi.mocked(p.gateway.inspectAttempt!).mockRejectedValueOnce(new Error('unavailable'));
    expect((await processExpiredOrders({ lojaID, gateway: p.gateway })).errorCount).toBeGreaterThan(0); expect(await stock(p)).toBe(4);
    expect((await stored(p.result.order.id)).paymentAttempts[0].status).toBe('PENDING');
  });
  it('outbox retry keeps the exact frozen email and same provider idempotency key', async () => {
    const p = await purchase(); p.remote[0].status = 'RECEIVED'; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    const send = vi.fn(async () => ({ success: false, error: 'timeout' }));
    for (let i=0;i<3;i++) await drainPaymentOutbox(50, send);
    const entry = await prisma.commerceOutbox.findUniqueOrThrow({ where: { effectKey: 'payment-confirmation:' + p.result.order.id } });
    expect(entry.status).toBe('READY'); expect(send.mock.calls.length).toBeGreaterThan(0);
    const first = send.mock.calls.find(call => (call as unknown as [{ idempotencyKey: string }])[0].idempotencyKey === entry.effectKey);
    await prisma.commerceOutbox.update({ where: { id: entry.id }, data: { nextAttemptAt: new Date(0) } });
    const retry = vi.fn(async () => ({ success: true, messageId: 'fixture-message' })); await drainPaymentOutbox(50, retry);
    const repeated = retry.mock.calls.find(call => (call as unknown as [{ idempotencyKey: string }])[0].idempotencyKey === entry.effectKey);
    expect(repeated).toEqual(first); expect((await prisma.commerceOutbox.findUniqueOrThrow({ where: { id: entry.id } })).status).toBe('COMPLETED');
  });
  it('provider idempotency window exhausted goes to review instead of sending again', async () => {
    const p = await purchase(); p.remote[0].status = 'RECEIVED'; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    const entry = await prisma.commerceOutbox.findUniqueOrThrow({ where: { effectKey: 'payment-confirmation:' + p.result.order.id } });
    await prisma.commerceOutbox.update({ where: { id: entry.id }, data: { payload: { deliveryStartedAt: '2000-01-01T00:00:00Z', options: {
      to: 'fixture@example.invalid', from: 'Fixture <fixture@example.invalid>', subject: 'Fixture', html: 'Fixture', text: 'Fixture' } } } });
    const send = vi.fn(async () => ({ success: true, messageId: 'fixture' })); await drainPaymentOutbox(50, send);
    expect((await prisma.commerceOutbox.findUniqueOrThrow({ where: { id: entry.id } })).status).toBe('DEAD_LETTER');
    expect(send.mock.calls.some(call => (call as unknown as [{ idempotencyKey: string }])[0].idempotencyKey === entry.effectKey)).toBe(false);
  });
  it('real HTTP persists RECEIVED, validates token and authenticates the executor', async () => {
    const p = await purchase(), e = await event(p); const url = '/api/webhooks/asaas'; const headers = { Host: host, 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN! };
    expect((await post(url, e.payload, { headers })).status).toBe(200); expect((await post(url, e.payload, { headers: { Host: host } })).status).toBe(401);
    expect((await post(url, { ...e.payload, payment: { ...e.payload.payment, value: -1 } }, { headers })).status).toBe(400);
    expect((await get('/api/cron/payments', { headers: { Host: host } })).status).toBe(401);
    expect((await get('/api/cron/payments/status', { headers: { Host: host } })).status).toBe(401);
    const status = await get('/api/cron/payments/status', { headers: { Host: host, Authorization: 'Bearer ' + process.env.CRON_SECRET } });
    expect(status.status).toBe(200); expect(status.body).toMatchObject({ schemaVersion: 1, operations: expect.any(Array) });
  });
  it('changing the configured provider account cannot adopt an existing attempt', async () => {
    const p = await purchase(); const before = await stored(p.result.order.id); vi.stubEnv('ASAAS_ACCOUNT_SCOPE', 'different-account');
    try { await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway); expect(p.gateway.inspectAttempt).not.toHaveBeenCalled(); }
    finally { vi.unstubAllEnvs(); }
    const after = await stored(p.result.order.id); expect(after.status).toBe(before.status); expect(await stock(p)).toBe(4);
    expect(after.paymentAttempts[0].providerAccount).toBe('primary');
  });
  it('persisted financial facts reject mutation and another order/charge provenance', async () => {
    const p = await purchase(); p.remote[0].status = 'RECEIVED'; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    const fact = await prisma.financialFact.findFirstOrThrow({ where: { orderId: p.result.order.id, type: 'SETTLED' } });
    await expect(prisma.financialFact.update({ where: { id: fact.id }, data: { amount: 1 } })).rejects.toThrow();
    const foreign = await purchase();
    await expect(prisma.financialFact.create({ data: { ...fact, id: randomUUID(), factKey: randomUUID(), orderId: foreign.result.order.id } })).rejects.toThrow();
  });
  it('a partially completed requested card refund resumes remaining operations only once', async () => {
    const p = await purchase(port(), 'CREDIT_CARD'); p.remote.forEach(r => { r.status = 'RECEIVED'; }); await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    await requestPaymentOperation({ orderId: p.result.order.id, lojaID, userId: adminID, kind: 'REFUND', commandId: randomUUID(), expectedVersion: 1 });
    const first = (await prisma.paymentOperation.findMany({ where: { attemptId: p.attempt.id }, include: { charge: true } })).find(o => o.charge.ordinal === 1)!;
    p.remote[0].status = 'REFUNDED';
    await prisma.paymentOperation.update({ where: { id: first.id }, data: { status: 'SUBMITTING', submittedAt: new Date(0) } });
    await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect((await stored(p.result.order.id)).status).toBe('CANCELLED'); expect(await stock(p)).toBe(5);
    expect(p.gateway.refundPayment).toHaveBeenCalledTimes(2);
    expect(vi.mocked(p.gateway.refundPayment!).mock.calls.map(c => c[0])).not.toContain(p.remote[0].paymentId);
  });
  it('unknown refund is not resubmitted and fulfillment is blocked while reversal is pending', async () => {
    const p = await purchase(); p.remote[0].status = 'RECEIVED'; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    await requestPaymentOperation({ orderId: p.result.order.id, lojaID, userId: adminID, kind: 'REFUND', commandId: randomUUID(), expectedVersion: 1 });
    vi.mocked(p.gateway.refundPayment!).mockRejectedValueOnce(new Error('lost result'));
    await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway); await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect(p.gateway.refundPayment).toHaveBeenCalledTimes(1); expect((await stored(p.result.order.id)).paymentAttempts[0].status).toBe('REFUND_PENDING');
    expect((await transitionOrder({ orderId: p.result.order.id, lojaID, newStatus: 'DELIVERED', performedById: adminID })).success).toBe(false);
    expect(await stock(p)).toBe(4);
  });
  it('payment arriving after expiry selection preserves PAID when the job relocks the order', async () => {
    const p = await purchase(); await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { reservationExpiresAt: new Date(0), externalExpiresAt: new Date(0) } });
    vi.mocked(p.gateway.inspectAttempt!).mockImplementationOnce(async () => {
      const stale = structuredClone(p.remote); p.remote[0].status = 'RECEIVED';
      await prisma.$transaction(async tx => { await new CommerceLocks(tx).acquire('order', [p.result.order.id]); await applyPaymentEvidence(tx, p.attempt.id, { complete: true, charges: p.remote }); });
      return { complete: true, charges: stale };
    });
    await processExpiredOrders({ lojaID, gateway: p.gateway }); expect((await stored(p.result.order.id)).status).toBe('PAID'); expect(await stock(p)).toBe(4);
    expect(await prisma.paymentOperation.count({ where: { attemptId: p.attempt.id } })).toBe(0);
  });
  it('authorized review retry restores inbox eligibility without restoring permission to submit a charge', async () => {
    const p = await purchase(), e = await event(p); await prisma.paymentInbox.update({ where: { id: e.row.id }, data: { status: 'DEAD_LETTER', attempts: 10 } });
    await requestPaymentReconciliation({ orderId: p.result.order.id, lojaID, userId: adminID, commandId: randomUUID() });
    expect((await prisma.paymentInbox.findUniqueOrThrow({ where: { id: e.row.id } })).status).toBe('READY');
    expect((await stored(p.result.order.id)).paymentAttempts[0].status).toBe('PENDING');
    await expect(requestPaymentReconciliation({ orderId: p.result.order.id, lojaID, userId: randomUUID(), commandId: randomUUID() })).rejects.toThrow('PAYMENT_RECONCILIATION_FORBIDDEN');
    expect(p.gateway.createPixCharge).toHaveBeenCalledTimes(1);
  });
  it('manual paid cancellation is refund pending, with explicit audited bank confirmation and one stock return', async () => {
    const p = await purchase(port(), 'WHATSAPP_PIX'); await transitionOrder({ orderId: p.result.order.id, lojaID, newStatus: 'PAID', performedById: adminID });
    expect((await stored(p.result.order.id)).paymentAttempts[0].status).toBe('APPROVED');
    await transitionOrder({ orderId: p.result.order.id, lojaID, newStatus: 'CANCELLED', performedById: adminID });
    const pending = await stored(p.result.order.id); expect(pending.paymentAttempts[0].status).toBe('REFUND_PENDING'); expect(await stock(p)).toBe(5);
    const confirmation = { orderId: p.result.order.id, lojaID, userId: adminID, action: 'CONFIRM_REFUND' as const, commandId: randomUUID(), expectedVersion: pending.version, bankReference: 'fixture-bank-ref-123' };
    expect((await manualRefund(confirmation)).replay).toBe(false); expect((await manualRefund(confirmation)).replay).toBe(true);
    expect((await stored(p.result.order.id)).paymentAttempts[0].status).toBe('REFUNDED'); expect(await stock(p)).toBe(5);
    expect(await prisma.financialFact.count({ where: { orderId: p.result.order.id, type: 'REFUNDED' } })).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: p.result.order.id, action: 'MANUAL_REFUND_CONFIRMED' } });
    expect(audit.actorId).toBe(adminID); expect(JSON.stringify(audit)).not.toContain(confirmation.bankReference);
    await expect(manualRefund({ ...confirmation, bankReference: 'different-bank-ref' })).rejects.toThrow('MANUAL_REFUND_COMMAND_CONFLICT');
  });
  it('manual delivered refund requires administrator attestation, does not infer physical return', async () => {
    const p = await purchase(port(), 'WHATSAPP_PIX'); await transitionOrder({ orderId: p.result.order.id, lojaID, newStatus: 'PAID', performedById: adminID });
    await transitionOrder({ orderId: p.result.order.id, lojaID, newStatus: 'DELIVERED', performedById: adminID });
    const command = { orderId: p.result.order.id, lojaID, userId: adminID, commandId: randomUUID(), expectedVersion: 2 };
    await manualRefund({ ...command, action: 'REQUEST_REFUND' }); expect(await stock(p)).toBe(4);
    await expect(manualRefund({ ...command, action: 'CONFIRM_REFUND', commandId: randomUUID() })).rejects.toThrow('MANUAL_REFUND_INVALID');
    await expect(manualRefund({ ...command, action: 'CONFIRM_REFUND', commandId: randomUUID(), bankReference: 'fixture-ref-123', userId: randomUUID() })).rejects.toThrow('MANUAL_REFUND_FORBIDDEN');
    await manualRefund({ ...command, action: 'CONFIRM_REFUND', commandId: randomUUID(), bankReference: 'fixture-ref-123' });
    const order = await stored(p.result.order.id); expect(order.status).toBe('DELIVERED'); expect(order.paymentAttempts[0].failureCode).toBe('PHYSICAL_RETURN_REQUIRED'); expect(await stock(p)).toBe(4);
  });
  it('late cancelled payment has an explicit full refund path without reopening inventory', async () => {
    const p = await purchase(); p.remote[0].deleted = true; await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    p.remote[0].deleted = false; p.remote[0].status = 'RECEIVED'; await event(p); await drainPaymentInbox(50, p.gateway);
    const order = await stored(p.result.order.id);
    await requestPaymentOperation({ orderId: order.id, lojaID, userId: adminID, kind: 'REFUND', commandId: randomUUID(), expectedVersion: order.version });
    await due(p.attempt.id); await reconcilePaymentAttempts(50, p.gateway);
    expect((await stored(order.id)).paymentAttempts[0].status).toBe('REFUNDED'); expect(await stock(p)).toBe(5); expect(p.gateway.refundPayment).toHaveBeenCalledTimes(1);
  });
});
