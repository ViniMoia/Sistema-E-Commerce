import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { assertCheckoutOpen } from '@/lib/commerce/checkout-availability';
import { createOrder, type CreateOrderParams } from '@/services/checkout.service';
import { proposeCheckout } from '@/services/checkout-intent.service';
import { POST as complete } from '@/app/api/checkout/route';
import { POST as proposal } from '@/app/api/checkout/intents/route';
import { POST as legacyOrder } from '@/app/api/orders/route';
import { POST as webhook } from '@/app/api/webhooks/asaas/route';
import { POST as worker } from '@/app/api/cron/payments/route';
import { receivePaymentEvent } from '@/services/payment/payment-inbox.service';
import { drainPaymentInbox, reconcilePaymentAttempts } from '@/services/payment/payment-worker.service';
import { drainPaymentOutbox } from '@/services/payment/payment-outbox.service';
import { processExpiredOrders } from '@/services/order-timeout.service';

vi.mock('@/lib/prisma', () => ({ default: { $transaction: vi.fn() } }));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'u', lojaID: 'l', status: 'ACTIVE' })) }));
vi.mock('@/lib/tenant', () => ({ getLojaFromHeaders: vi.fn(async () => ({ id: 'l' })) }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn(() => null) }));
vi.mock('@/services/payment/payment-inbox.service', () => ({ receivePaymentEvent: vi.fn(async () => ({ eventId: 'event' })) }));
vi.mock('@/services/payment/payment-worker.service', () => ({
  drainPaymentInbox: vi.fn(async () => ({ completed: 1 })),
  reconcilePaymentAttempts: vi.fn(async () => ({ completed: 1 })),
}));
vi.mock('@/services/payment/payment-outbox.service', () => ({ drainPaymentOutbox: vi.fn(async () => ({ completed: 1 })) }));
vi.mock('@/services/order-timeout.service', () => ({ processExpiredOrders: vi.fn(async () => ({ success: true })) }));

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CHECKOUT_PAUSED', 'true'); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('purchase containment independent of financial consumers', () => {
  it.each([undefined, 'false'])('preserves existing behavior when %s', value => {
    vi.stubEnv('CHECKOUT_PAUSED', value);
    expect(() => assertCheckoutOpen()).not.toThrow();
  });
  it.each(['true', '', 'FALSE', '0', 'invalid'])('fails closed for configured value %s', value => {
    vi.stubEnv('CHECKOUT_PAUSED', value);
    expect(() => assertCheckoutOpen()).toThrow('CHECKOUT_PAUSED');
  });
  it.each(['PIX', 'BOLETO', 'CREDIT_CARD', 'WHATSAPP_PIX'] as const)('blocks direct %s commands before transaction/gateway access', async paymentMethod => {
    const input: CreateOrderParams = { lojaID: 'l', customer: { name: '', email: '', phone: '' }, items: [], deliveryType: 'PICKUP', paymentMethod };
    await expect(proposeCheckout(input)).rejects.toThrow('CHECKOUT_PAUSED');
    await expect(createOrder(input)).rejects.toThrow('CHECKOUT_PAUSED');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([['proposal', proposal], ['checkout', complete], ['orders', legacyOrder]] as const)('%s returns an uncached 503 without accepting a new command', async (_name, handler) => {
    const response = await handler(new Request('http://localhost/api/checkout', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ success: false, error: 'CHECKOUT_PAUSED' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('keeps authenticated webhook acceptance and all four consumer phases available', async () => {
    vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'fixture-webhook');
    vi.stubEnv('CRON_SECRET', 'fixture-cron');
    vi.stubEnv('PAYMENT_WORKER_ENABLED', 'true');
    const received = await webhook(new Request('http://localhost/api/webhooks/asaas', { method: 'POST',
      headers: { 'asaas-access-token': 'fixture-webhook' }, body: JSON.stringify({ id: 'event' }) }));
    expect(received.status).toBe(200);
    expect(receivePaymentEvent).toHaveBeenCalledWith({ id: 'event' });
    const processed = await worker(new Request('http://localhost/api/cron/payments', { method: 'POST',
      headers: { authorization: 'Bearer fixture-cron' } }));
    expect(processed.status).toBe(200);
    for (const phase of [drainPaymentInbox, reconcilePaymentAttempts, processExpiredOrders, drainPaymentOutbox]) expect(phase).toHaveBeenCalledTimes(1);
  });
  it('does not bypass webhook or consumer authentication', async () => {
    vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'fixture-webhook');
    vi.stubEnv('CRON_SECRET', 'fixture-cron');
    vi.stubEnv('PAYMENT_WORKER_ENABLED', 'true');
    expect((await webhook(new Request('http://localhost/api/webhooks/asaas', { method: 'POST' }))).status).toBe(401);
    expect((await worker(new Request('http://localhost/api/cron/payments', { method: 'POST' }))).status).toBe(401);
    expect(receivePaymentEvent).not.toHaveBeenCalled();
    expect(drainPaymentInbox).not.toHaveBeenCalled();
  });
});
