import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { chargebackFixture } from '@/tests/setup/chargeback-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { paymentBacklog } from '@/services/payment/payment-supervision.service';
import { paymentAccountScope } from '@/lib/commerce/payment-account';
import { get, verifyTestServer } from '@/tests/helpers/request';
import { testServerConfig } from '@/lib/testing/database-policy';
import { runConsumer } from '../../scripts/cloudrun-consumer.mjs';

const inboxIds: string[] = [];
beforeEach(async () => { await verifyTestDatabase(); vi.stubEnv('INSTALLMENT_MONTHLY_RATE', '0'); vi.stubEnv('INSTALLMENT_ABSORB_FEES', 'false'); });
afterEach(async () => {
  await prisma.paymentInbox.deleteMany({ where: { id: { in: inboxIds.splice(0) } } });
  vi.restoreAllMocks(); vi.unstubAllEnvs(); await cleanupFixtureStores(); await prisma.$disconnect();
});

describe('read-only installation supervision', () => {
  it('reports review and held operation even without an outbox alert; repeated snapshots do not mutate the case', async () => {
    const p = await chargebackFixture();
    const charge = await prisma.paymentCharge.findFirstOrThrow({ where: { attemptId: p.attempt.id } });
    await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { failureCode: 'PAYMENT_CHARGEBACK_REVIEW' } });
    await prisma.paymentOperation.create({ data: { attemptId: p.attempt.id, chargeId: charge.id, kind: 'REFUND', commandKey: randomUUID(), lastErrorCode: 'PAYMENT_CHARGEBACK_REVIEW' } });
    await prisma.commerceOutbox.deleteMany({ where: { aggregateId: p.orderId } });
    const before = await p.read(), stock = await p.stock();
    const facts = await prisma.financialFact.findMany({ where: { orderId: p.orderId } });
    const audit = await prisma.auditLog.count(), points = await prisma.loyaltyTransaction.findMany({ where: { orderId: p.orderId } });
    for (let n = 0; n < 2; n++) {
      const s = await paymentBacklog();
      expect(s.supervision).toMatchObject({ schemaVersion: 1, reviewAttempts: 1, chargebackReviews: 1, heldOperations: 1 });
      expect(s.outbox).toEqual([]);
      expect(JSON.stringify(s)).not.toContain(p.orderId);
    }
    expect(await p.read()).toEqual(before); expect(await p.stock()).toEqual(stock);
    expect(await prisma.financialFact.findMany({ where: { orderId: p.orderId } })).toEqual(facts);
    expect(await prisma.loyaltyTransaction.findMany({ where: { orderId: p.orderId } })).toEqual(points);
    expect(await prisma.auditLog.count()).toBe(audit);
  });

  it('includes terminal physical review, expired queue leases, delayed email and foreign account coverage', async () => {
    const p = await chargebackFixture(), old = new Date(Date.now() - 600000);
    await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { status: 'REFUNDED', failureCode: 'PHYSICAL_RETURN_REQUIRED', providerAccount: 'different-account' } });
    const inbox = await prisma.paymentInbox.create({ data: { provider: 'ASAAS:' + paymentAccountScope(), eventId: randomUUID(), eventType: 'fixture', payload: { private: 'not-for-supervision' }, status: 'LEASED', leaseOwner: 'test', leaseExpiresAt: old, receivedAt: old } });
    inboxIds.push(inbox.id);
    await prisma.commerceOutbox.updateMany({ where: { aggregateId: p.orderId }, data: { status: 'COMPLETED' } });
    await prisma.commerceOutbox.create({ data: { aggregateId: p.orderId, commandType: 'PAYMENT_CONFIRMATION_EMAIL', effectKey: randomUUID(), payload: { secret: 'not-for-supervision' }, status: 'DEAD_LETTER', createdAt: old } });
    await prisma.commerceOutbox.create({ data: { aggregateId: p.orderId, commandType: 'PAYMENT_REVIEW', effectKey: randomUUID(), payload: {}, status: 'LEASED', leaseOwner: 'test', leaseExpiresAt: old, createdAt: old } });
    const s = await paymentBacklog();
    expect(s.supervision).toMatchObject({ reviewAttempts: 1, physicalReturnReviews: 1, expiredQueueLeases: 2, emailDeadLetters: 1, foreignAccountAttempts: 1,
      oldestPendingEmailAt: old.toISOString(), oldestUnresolvedOutboxAt: old.toISOString(), oldestDueReconciliationAt: null });
    expect(JSON.stringify(s)).not.toContain('not-for-supervision');
  });

  it('authenticated HTTP observer detects uncertainty and later recovery without any processing request', async () => {
    const p = await chargebackFixture(), old = new Date(Date.now() - 600000);
    await prisma.commerceOutbox.updateMany({ where: { aggregateId: p.orderId }, data: { status: 'COMPLETED' } });
    await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { status: 'UNKNOWN', reconcileAfter: old } });
    await verifyTestServer();
    const { baseUrl } = testServerConfig();
    const methods: string[] = [], cacheHeaders: Array<string | null> = [];
    const observe = () => runConsumer({ CONSUMER_MODE: 'supervision', CONSUMER_ORIGIN: 'https://observer.example', CRON_SECRET: process.env.CRON_SECRET,
      PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX', ASAAS_ACCOUNT_SCOPE: paymentAccountScope() }, { log() {}, fetcher: async (_url, options) => {
      methods.push(options.method); expect(options.method).toBe('GET');
      const response = await fetch(baseUrl + '/api/cron/payments/status', options);
      cacheHeaders.push(response.headers.get('cache-control'));
      return response;
    } });
    const before = await p.read();
    const warning = await observe();
    expect(warning).toMatchObject({ outcome: 'attention', processingAttempted: false, batches: 0 });
    expect(warning.attentionReasons).toEqual(expect.arrayContaining(['PAYMENT_UNCERTAIN','RECONCILIATION_DELAY']));
    expect(await p.read()).toEqual(before);
    await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { status: 'APPROVED', reconcileAfter: new Date(Date.now() + 3600000) } });
    expect(await observe()).toMatchObject({ outcome: 'idle', attentionReasons: [], processingAttempted: false });
    expect(methods).toEqual(['GET','GET']);
    expect(cacheHeaders).toHaveLength(2);
    for (const header of cacheHeaders) expect(header).toContain('no-store');
  });

  it('rejects unauthenticated and incorrect credentials without disclosing supervision', async () => {
    for (const headers of [{}, { Authorization: 'Bearer wrong' }]) {
      const r = await get('/api/cron/payments/status', { headers });
      expect(r.status).toBe(401); expect(r.body).not.toHaveProperty('supervision');
    }
  });
});
