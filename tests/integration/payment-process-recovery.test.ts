import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { acceptFixtureCheckout } from '@/tests/setup/checkout-fixture';
import { receivePaymentEvent } from '@/services/payment/payment-inbox.service';
import { requestPaymentOperation } from '@/services/payment/payment-operations.service';
import { requestPaymentReconciliation } from '@/services/payment/payment-supervision.service';
import type { PaymentGateway, RemoteCharge } from '@/types/payment-gateway.types';
import type { ProcessTask } from '@/tests/helpers/payment-process-worker';

// Provider state lives outside the processes that are killed. IPC is the only
// transport: no Asaas/Resend/Preview access, no test hooks in production code.
const remote = new Map<string, RemoteCharge>();
const sent = new Map<string, string>();
const sends: string[] = [];
let submissions = 0;
const reversals: Array<{ kind: string; paymentId: string; amount?: number }> = [];
let lojaID: string;
const children = new Set<ChildProcess>();
type Notice = { type: string; id?: number; operation?: string; value?: Record<string, unknown>; result?: unknown; name?: string };

async function worker(task: ProcessTask) {
  await verifyTestDatabase();
  const child = spawn(process.execPath, [path.resolve('tests/helpers/payment-process-entry.mjs')], {
    windowsHide: true,
    env: { ...process.env, NODE_ENV: 'test', ASAAS_API_KEY: '', RESEND_API_KEY: '' },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  children.add(child);
  const messages: Notice[] = [];
  let failure: string | undefined;
  let stopped = false;
  const exited = new Promise<void>(resolve => child.once('exit', () => { stopped = true; resolve(); }));
  child.on('error', () => { failure = 'Child failed to start'; });
  child.on('message', (raw: Notice) => {
    messages.push(raw);
    if (raw.type === 'failure') failure = 'Child fixture failed (diagnostics suppressed to protect configuration)';
    if (raw.type !== 'rpc') return;
    const input = raw.value!;
    let value: unknown;
    if (raw.operation === 'create') {
      submissions++;
      const payment: RemoteCharge = { paymentId: randomUUID(), externalReference: String(input.orderId), method: 'PIX', ordinal: 1,
        value: Number(input.value), status: 'PENDING', instructions: { pixPayload: 'process-copy', pixQrCodeBase64: 'process-qr', expiresAt: '2030-10-05T12:00:00Z' } };
      remote.set(payment.paymentId, payment);
      value = { ...payment, pixPayload: 'process-copy', pixQrCodeBase64: 'process-qr', expirationDate: payment.instructions!.expiresAt };
    } else if (raw.operation === 'inspect') {
      value = { complete: true, charges: [...remote.values()].filter(c => c.externalReference === input.externalReference) };
    } else if (raw.operation === 'cancel' || raw.operation === 'refund') {
      const payment = remote.get(String(input.paymentId));
      if (!payment || (raw.operation === 'refund' && input.amount !== payment.value)) {
        failure = 'Reversal has incorrect charge identity or amount'; return;
      }
      reversals.push({ kind: raw.operation, paymentId: payment.paymentId,
        ...(raw.operation === 'refund' ? { amount: Number(input.amount) } : {}) });
      if (raw.operation === 'cancel') payment.deleted = true;
      else payment.status = 'REFUNDED';
      value = null;
    } else if (raw.operation === 'send') {
      const key = String(input.idempotencyKey);
      const body = JSON.stringify(input);
      // Controlled provider models acceptance/idempotency, not real delivery.
      if (sent.has(key) && sent.get(key) !== body) { failure = 'Retry changed frozen email content'; return; }
      sends.push(key); sent.set(key, body);
      value = { success: true, messageId: 'accepted:' + key };
    } else { failure = 'Unexpected provider operation'; return; }
    if (child.connected) child.send({ type: 'reply', id: raw.id, value });
  });
  async function wait(type: string) {
    for (let i = 0; i < 600; i++) {
      if (failure) throw new Error(failure);
      const notice = messages.find(m => m.type === type);
      if (notice) return notice;
      if (stopped) throw new Error('Child exited before ' + type);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('Child timed out before ' + type);
  }
  await wait('ready');
  child.send({ type: 'task', task });
  return {
    pid: child.pid!, wait,
    resume: () => child.send({ type: 'resume' }),
    kill: async () => { child.kill('SIGKILL'); await exited; children.delete(child); },
    finish: async () => {
      const message = await wait('done');
      for (let i = 0; i < 200 && !stopped; i++) await new Promise(resolve => setTimeout(resolve, 25));
      if (!stopped) throw new Error('Child did not release its resources');
      expect(child.exitCode).toBe(0);
      children.delete(child); return message.result;
    },
  };
}
const fixtureGateway: PaymentGateway = {
  capabilities: async () => ({ configured: true, methods: ['PIX'], maximumInstallments: 1 }),
  createPixCharge: async () => { throw new Error('Only a separate process may submit'); },
  createBoletoCharge: async () => { throw new Error('Not used'); },
  createCreditCardCharge: async () => { throw new Error('Not used'); },
  getPaymentStatus: async () => { throw new Error('Not used'); },
};
beforeEach(async () => {
  await verifyTestDatabase();
  remote.clear(); sent.clear(); sends.length = 0; submissions = 0; reversals.length = 0;
  lojaID = await createFixtureStore();
  await prisma.loja.update({ where: { id: lojaID }, data: { enablePix: true, enablePickup: true, loyaltyEnabled: true, loyaltyEarnRate: 1 } });
});
afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGKILL'); await exited;
    }
  }
  children.clear();
  await cleanupFixtureStores();
  await prisma.$disconnect();
});
async function proposal() {
  const buyer = await prisma.user.create({ data: { lojaID, name: 'Process buyer', email: randomUUID() + '@example.invalid', password: '' } });
  const product = await prisma.product.create({ data: { lojaID, userID: buyer.id, name: 'Process product', description: '', imageUrl: '', price: 100, stock: 5,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 5 } } }, include: { productVariants: true } });
  const prepared = await acceptFixtureCheckout({ lojaID, customer: { userId: buyer.id, name: buyer.name, email: buyer.email, phone: '11999999999', cpfCnpj: '52998224725' },
    items: [{ productId: product.id, variantId: product.productVariants[0].id, quantity: 1 }], deliveryType: 'PICKUP', paymentMethod: 'PIX', paymentGateway: fixtureGateway });
  const { paymentGateway: _gateway, ...input } = prepared;
  return { input, product, buyer };
}
async function order() { return prisma.order.findFirstOrThrow({ where: { lojaID }, include: { paymentAttempts: true, reservations: true } }); }
async function expireLeases() {
  const row = await order();
  await prisma.paymentAttempt.updateMany({ where: { orderId: row.id }, data: { reconcileAfter: new Date(0) } });
  await prisma.paymentAttempt.updateMany({ where: { orderId: row.id, leaseOwner: { not: null } }, data: { leaseExpiresAt: new Date(0) } });
  await prisma.paymentInbox.updateMany({ where: { status: 'LEASED', payload: { path: ['payment', 'externalReference'], equals: row.id } }, data: { leaseExpiresAt: new Date(0), nextAttemptAt: new Date(0) } });
  await prisma.commerceOutbox.updateMany({ where: { aggregateId: row.id, status: 'LEASED' }, data: { leaseExpiresAt: new Date(0), nextAttemptAt: new Date(0) } });
}
async function notifyPaid() {
  const charge = [...remote.values()][0]; charge.status = 'RECEIVED';
  return receivePaymentEvent({ id: randomUUID(), event: 'PAYMENT_RECEIVED', payment: { id: charge.paymentId,
    externalReference: charge.externalReference, billingType: 'PIX', value: charge.value, status: 'RECEIVED' } });
}
async function effects(p: Awaited<ReturnType<typeof proposal>>, paid: boolean) {
  const row = await order();
  expect(row).toMatchObject({ status: paid ? 'PAID' : 'PENDING', version: paid ? 1 : 0,
    reservations: [{ status: paid ? 'COMMITTED' : 'RESERVED' }] });
  expect(await prisma.order.count({ where: { lojaID } })).toBe(1);
  expect(await prisma.paymentAttempt.count({ where: { orderId: row.id } })).toBe(1);
  expect(await prisma.product.findUniqueOrThrow({ where: { id: p.product.id } })).toMatchObject({ stock: 4 });
  expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: p.product.productVariants[0].id } })).toMatchObject({ stock: 4 });
  expect(await prisma.financialFact.count({ where: { orderId: row.id } })).toBe(paid ? 2 : 0);
  expect(await prisma.orderStatusHistory.count({ where: { orderId: row.id } })).toBe(paid ? 1 : 0);
  expect(await prisma.loyaltyTransaction.count({ where: { orderId: row.id, type: 'EARN' } })).toBe(paid ? 1 : 0);
  expect(await prisma.commerceOutbox.count({ where: { effectKey: 'payment-confirmation:' + row.id } })).toBe(paid ? 1 : 0);
  return row;
}

describe('L-01: real process death, isolated PostgreSQL and controlled provider', () => {
  it('death before the order commit rolls back the cart, intent, stock and durable effects', async () => {
    const p = await proposal();
    const before = {
      cart: await prisma.cart.findUniqueOrThrow({ where: { id: p.input.cartID! } }),
      intent: await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: p.input.checkoutIntentID! } }),
    };
    const first = await worker({ action: 'checkout', input: p.input, pause: 'order-before-commit' });
    expect(await first.wait('checkpoint')).toMatchObject({ name: 'order-before-commit' }); await first.kill();
    expect(await prisma.order.count({ where: { lojaID } })).toBe(0);
    expect(await prisma.cart.findUniqueOrThrow({ where: { id: before.cart.id } })).toEqual(before.cart);
    expect(await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: before.intent.id } })).toEqual(before.intent);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: p.product.id } })).toMatchObject({ stock: 5 });
    expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: p.product.productVariants[0].id } })).toMatchObject({ stock: 5 });
    expect(await prisma.commerceOutbox.count({ where: { effectKey: 'checkout:' + before.intent.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { effectKey: 'checkout:' + before.intent.id } })).toBe(0);
    expect(submissions).toBe(0);
    const recovery = await worker({ action: 'checkout', input: p.input });
    expect(recovery.pid).not.toBe(first.pid);
    expect(await recovery.finish()).toMatchObject({ paymentState: 'ISSUED' });
    await effects(p, false); expect(submissions).toBe(1);
  }, 60000);

  it.each([
    ['CANCEL', 'before-operation'], ['CANCEL', 'after-operation'],
    ['CANCEL', 'operation-before-commit'], ['CANCEL', 'after-commit'],
    ['REFUND', 'before-operation'], ['REFUND', 'after-operation'],
    ['REFUND', 'operation-before-commit'], ['REFUND', 'after-commit'],
  ] as const)('%s interrupted at %s never repeats the external reversal or releases stock without proof', async (kind, pause) => {
    const p = await proposal();
    await (await worker({ action: 'checkout', input: p.input })).finish();
    if (kind === 'REFUND') { await notifyPaid(); await (await worker({ action: 'inbox' })).finish(); }
    const row = await order();
    const admin = await prisma.user.create({ data: { lojaID, name: 'Reversal admin', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } });
    const command = { orderId: row.id, lojaID, userId: admin.id, kind, commandId: randomUUID(), expectedVersion: row.version };
    const requested = await requestPaymentOperation(command);
    await expireLeases();
    const first = await worker({ action: 'reconcile', pause });
    expect(await first.wait('checkpoint')).toMatchObject({ name: pause }); await first.kill();
    if (pause !== 'after-commit') await effects(p, kind === 'REFUND');
    expect(reversals).toHaveLength(pause === 'before-operation' ? 0 : 1);
    // Replay of the command itself preserves identity, even after an uncertain submission.
    expect((await requestPaymentOperation(command)).operations.map(o => o.id)).toEqual(requested.operations.map(o => o.id));
    await expireLeases();
    const recovery = await worker({ action: 'reconcile' });
    expect(recovery.pid).not.toBe(first.pid); await recovery.finish();
    if (pause === 'before-operation') {
      // The durable submission marker precedes I/O: absence of proof must not grant permission to send again.
      await effects(p, kind === 'REFUND');
      expect(await prisma.paymentOperation.findUniqueOrThrow({ where: { id: requested.operations[0].id } })).toMatchObject({ status: 'SUBMITTING' });
      // An unresolved reversal must become visible for review, not silently remain pending forever.
      await prisma.paymentAttempt.update({ where: { id: requested.attemptId }, data: { reviewAfter: new Date(0), reconcileAfter: new Date(0) } });
      expect(await (await worker({ action: 'reconcile' })).finish()).toMatchObject({ review: 1 });
      expect((await order()).paymentAttempts[0]).toMatchObject({ failureCode: 'PAYMENT_REVERSAL_OVERDUE' });
      expect(await prisma.commerceOutbox.count({ where: { effectKey: 'payment-review:' + requested.attemptId + ':PAYMENT_REVERSAL_OVERDUE' } })).toBe(1);
      await requestPaymentReconciliation({ orderId: row.id, lojaID, userId: admin.id, commandId: randomUUID() });
      await (await worker({ action: 'reconcile' })).finish();
      await effects(p, kind === 'REFUND');
      expect(await prisma.paymentOperation.findUniqueOrThrow({ where: { id: requested.operations[0].id } })).toMatchObject({ status: 'SUBMITTING' });
    } else {
      const settled = await order();
      expect(settled).toMatchObject({ status: 'CANCELLED', version: kind === 'REFUND' ? 2 : 1,
        reservations: [{ status: kind === 'REFUND' ? 'RETURNED' : 'RELEASED' }] });
      expect(await prisma.product.findUniqueOrThrow({ where: { id: p.product.id } })).toMatchObject({ stock: 5 });
      expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: p.product.productVariants[0].id } })).toMatchObject({ stock: 5 });
      expect(await prisma.paymentOperation.findUniqueOrThrow({ where: { id: requested.operations[0].id } })).toMatchObject({ status: 'COMPLETED' });
      expect(await prisma.financialFact.count({ where: { orderId: row.id, type: kind === 'REFUND' ? 'REFUNDED' : 'CANCELLED' } })).toBe(1);
      expect(await prisma.orderStatusHistory.count({ where: { orderId: row.id } })).toBe(kind === 'REFUND' ? 2 : 1);
      const transactions = await prisma.loyaltyTransaction.findMany({ where: { orderId: row.id }, orderBy: { id: 'asc' } });
      if (kind === 'REFUND') {
        expect(transactions.filter(t => t.type === 'EARN')).toHaveLength(1);
        expect(transactions.filter(t => t.type === 'REFUND_EARN')).toHaveLength(1);
        expect(transactions.reduce((total, t) => total + t.points, 0)).toBe(0);
        expect(await prisma.loyaltyWallet.findUniqueOrThrow({ where: { lojaID_userID: { lojaID, userID: p.buyer.id } } })).toMatchObject({ balance: 0, pending: 0, debt: 0 });
      } else expect(transactions).toHaveLength(0);
      const facts = await prisma.financialFact.findMany({ where: { orderId: row.id }, orderBy: { id: 'asc' } });
      await expireLeases(); await (await worker({ action: 'reconcile' })).finish();
      expect(await prisma.loyaltyTransaction.findMany({ where: { orderId: row.id }, orderBy: { id: 'asc' } })).toEqual(transactions);
      expect(await prisma.financialFact.findMany({ where: { orderId: row.id }, orderBy: { id: 'asc' } })).toEqual(facts);
      expect(await prisma.product.findUniqueOrThrow({ where: { id: p.product.id } })).toMatchObject({ stock: 5 });
    }
    expect(reversals).toHaveLength(pause === 'before-operation' ? 0 : 1);
    expect(submissions).toBe(1);
  }, 60000);

  it.each(['before-create', 'after-create', 'after-commit'] as const)('checkout killed at %s cannot resubmit the accepted intent', async pause => {
    const p = await proposal();
    const first = await worker({ action: 'checkout', input: p.input, pause });
    expect(await first.wait('checkpoint')).toMatchObject({ name: pause }); await first.kill();
    await effects(p, false);
    expect(submissions).toBe(pause === 'before-create' ? 0 : 1);
    await expireLeases();
    const recovery = await worker({ action: 'reconcile' });
    expect(recovery.pid).not.toBe(first.pid);
    const summary = await recovery.finish();
    expect(summary).toMatchObject(pause === 'before-create' ? { retried: 1 } : { completed: 1, retried: 0 });
    const replay = await worker({ action: 'checkout', input: p.input });
    expect(await replay.finish()).toMatchObject({ paymentState: pause === 'before-create' ? 'PROCESSING' : 'ISSUED' });
    const row = await effects(p, false);
    expect(row.paymentAttempts[0].status).toBe(pause === 'before-create' ? 'UNKNOWN' : 'PENDING');
    expect(submissions).toBe(pause === 'before-create' ? 0 : 1);
  }, 60000);

  it.each([
    ['inbox', 'before-commit'], ['inbox', 'after-commit'],
    ['reconcile', 'before-commit'], ['reconcile', 'after-commit'],
  ] as const)('%s consumer killed at %s recovers financial effects exactly once', async (action, pause) => {
    const p = await proposal();
    await (await worker({ action: 'checkout', input: p.input })).finish();
    await notifyPaid();
    await expireLeases();
    const first = await worker({ action, pause });
    expect(await first.wait('checkpoint')).toMatchObject({ name: pause }); await first.kill();
    await effects(p, pause === 'after-commit');
    await expireLeases();
    await (await worker({ action: 'inbox' })).finish();
    await (await worker({ action: 'reconcile' })).finish();
    await effects(p, true);
    expect(await prisma.paymentInbox.count({ where: { status: 'COMPLETED' } })).toBe(1);
    expect(submissions).toBe(1);
  }, 60000);

  it('webhook wins before checkout response, without regressing the remote status', async () => {
    const p = await proposal();
    const checkout = await worker({ action: 'checkout', input: p.input, pause: 'after-create' });
    await checkout.wait('checkpoint');
    await notifyPaid();
    await (await worker({ action: 'inbox' })).finish();
    await effects(p, true);
    checkout.resume(); await checkout.finish();
    expect(await effects(p, true)).toMatchObject({ asaasPaymentStatus: 'RECEIVED', paymentAttempts: [{ status: 'APPROVED' }] });
    expect(submissions).toBe(1);
  }, 60000);

  it.each(['inbox', 'reconcile'] as const)('an old %s consumer resuming after lease takeover cannot apply its stale lookup', async action => {
    const p = await proposal();
    await (await worker({ action: 'checkout', input: p.input })).finish();
    await notifyPaid(); [...remote.values()][0].status = 'PENDING';
    await expireLeases();
    const old = await worker({ action, pause: 'after-inspect' });
    await old.wait('checkpoint');
    const held = await prisma.paymentInbox.findFirstOrThrow();
    await expireLeases(); [...remote.values()][0].status = 'RECEIVED';
    const successor = await worker({ action });
    expect(successor.pid).not.toBe(old.pid);
    expect(await successor.finish()).toMatchObject({ completed: 1, retried: 0 });
    old.resume(); expect(await old.finish()).toMatchObject({ completed: 0, retried: 1 });
    if (action === 'inbox') {
      expect(await prisma.paymentInbox.findUniqueOrThrow({ where: { id: held.id } })).toMatchObject({ status: 'COMPLETED', attempts: 2, leaseOwner: null });
    } else {
      expect((await order()).paymentAttempts[0]).toMatchObject({ status: 'APPROVED', leaseOwner: null, leaseExpiresAt: null });
      await (await worker({ action: 'inbox' })).finish();
    }
    expect(await effects(p, true)).toMatchObject({ asaasPaymentStatus: 'RECEIVED' });
  }, 60000);

  it('a second process cannot steal a live inbox lease or duplicate approval', async () => {
    const p = await proposal();
    await (await worker({ action: 'checkout', input: p.input })).finish();
    await notifyPaid();
    const first = await worker({ action: 'inbox', pause: 'after-inspect' });
    await first.wait('checkpoint');
    const second = await worker({ action: 'inbox' });
    expect(second.pid).not.toBe(first.pid);
    expect(await second.finish()).toMatchObject({ claimed: 0, completed: 0 });
    first.resume(); expect(await first.finish()).toMatchObject({ claimed: 1, completed: 1 });
    await effects(p, true);
    expect(submissions).toBe(1);
  }, 60000);

  it('email accepted before process death is retried with the same frozen content and identity', async () => {
    const p = await proposal();
    await (await worker({ action: 'checkout', input: p.input })).finish();
    await notifyPaid(); await (await worker({ action: 'inbox' })).finish();
    const sender = await worker({ action: 'outbox', pause: 'after-send' });
    await sender.wait('checkpoint'); await sender.kill();
    expect(sent.size).toBe(1); expect(sends).toHaveLength(1);
    await expireLeases();
    await (await worker({ action: 'outbox' })).finish();
    expect(sent.size).toBe(1); expect(sends).toHaveLength(2);
    expect(sends[0]).toBe(sends[1]);
    const row = await effects(p, true);
    expect(await prisma.commerceOutbox.findUniqueOrThrow({ where: { effectKey: 'payment-confirmation:' + row.id } })).toMatchObject({ status: 'COMPLETED' });
    expect(submissions).toBe(1);
  }, 60000);
});
