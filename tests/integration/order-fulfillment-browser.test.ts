import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';
import { transitionOrder } from '@/lib/commerce/order-command';
let f: Awaited<ReturnType<typeof createFulfillmentFixture>>;
let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let heldOrder: string | null = null;
let heldPayload: Record<string, unknown> | null = null;
let release: () => void = () => {};
beforeAll(async () => {
  await verifyTestDatabase(); f = await createFulfillmentFixture();
  browser = await isolatedBrowser({ host: f.host, intercept: async ({ url, method, body }) => {
    if (heldOrder && url === '/api/admin/orders/' + heldOrder + '/status' && method === 'PATCH') {
      heldPayload = JSON.parse(body); await new Promise<void>(resolve => { release = resolve; });
    }
    return null;
  } });
  await browser.send('Network.setCookie', { name: 'session_id', value: f.session.id, url: browser.origin, httpOnly: true });
}, 120000);
afterAll(async () => { release(); if (browser) await browser.close(); await cleanupFixtureStores(); await prisma.$disconnect(); }, 30000);
const text = (s: string) => 'document.body.innerText.toLocaleLowerCase().includes(' + JSON.stringify(s.toLocaleLowerCase()) + ')';
async function openOrder(order: { orderNumber: number }) {
  await browser.navigate('/admin/orders');
  const row = '[...document.querySelectorAll("tbody tr")].find(e=>e.textContent.includes(' + JSON.stringify('#' + order.orderNumber) + '))';
  await browser.waitFor('!!' + row, 45000); await browser.evaluate(row + '.click()');
  await browser.waitFor('!![...document.querySelectorAll("button")].find(e=>e.textContent.includes("Atualizar Status")&&!e.disabled)', 45000);
}
describe('WF-16: actual Admin drawer/modal in isolated Next and Chrome', () => {
  it('persists every promised shipping field, rereads authoritative detail and versions subsequent tracking edits', async () => {
    const o = await f.order('DELIVERY', 'CORREIOS'); await openOrder(o); await browser.click('Atualizar Status');
    await browser.click('Despachado / Enviado');
    expect(await browser.evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent.includes("Confirmar Transição")).disabled')).toBe(true);
    await browser.input('shippingTrackingCode', 'INVALID'); await browser.click('Confirmar Transição');
    await browser.waitFor(text('Informe um código válido dos Correios'));
    expect(await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: 'PAID', trackingCode: null, version: 1 });
    await browser.input('shippingTrackingCode', 'aa123456789br'); await browser.click('Confirmar Transição');
    await browser.waitFor(text('AA123456789BR') + ' && !document.querySelector(\'input[name="shippingTrackingCode"]\')', 45000);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: 'SHIPPED', trackingCode: 'AA123456789BR', version: 2 });
    await browser.click('Alterar'); await browser.input('editingTrackingCode', 'bb123456789br'); await browser.click('Salvar');
    await browser.waitFor(text('BB123456789BR') + ' && !document.querySelector(\'input[name="editingTrackingCode"]\')');
    expect(await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: 'SHIPPED', trackingCode: 'BB123456789BR', version: 3 });
    expect(await browser.evaluate(text('Rastreamento atualizado; status mantido'))).toBe(true);
  }, 180000);
  it.each(['PICKUP', 'NONE'] as const)('exposes direct completion for %s and records Admin authorship without customer receipt', async deliveryType => {
    const o = await f.order(deliveryType); await openOrder(o); await browser.click('Atualizar Status');
    expect(await browser.evaluate('[...document.querySelectorAll("button")].some(e=>e.textContent.includes("Despachado / Enviado"))')).toBe(false);
    expect(await browser.evaluate('!!document.querySelector(\'input[name="shippingTrackingCode"]\')')).toBe(false);
    await browser.click('Concluir retirada / entrega ao cliente'); await browser.click('Confirmar Transição');
    await browser.waitFor(text('Status atualizado para Entregue'), 45000);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: 'DELIVERED', version: 2, deliveredConfirmedBy: null, deliveredConfirmedAt: null });
    expect(await prisma.orderStatusHistory.findFirstOrThrow({ where: { orderId: o.id, orderVersion: 2 } })).toMatchObject({ performedById: f.admin.id, previousStatus: 'PAID' });
  }, 120000);
  it('delayed actual modal submission loses to cancellation and displays conflict with reread state', async () => {
    const o = await f.order('DELIVERY', 'CORREIOS'); await openOrder(o); heldOrder = o.id; heldPayload = null;
    try {
      await browser.click('Atualizar Status'); await browser.click('Despachado / Enviado');
      await browser.input('shippingTrackingCode', 'AA123456789BR'); await browser.click('Confirmar Transição');
      await expect.poll(() => heldPayload, { timeout: 10000 }).not.toBeNull();
      expect(heldPayload).toMatchObject({ newStatus: 'SHIPPED', trackingCode: 'AA123456789BR', expectedVersion: 1, shippingProvider: 'CORREIOS' });
      expect(heldPayload.commandId).toEqual(expect.any(String));
      expect(await transitionOrder({ ...f.context, orderId: o.id, newStatus: 'CANCELLED', commandId: randomUUID(), expectedVersion: 1 })).toMatchObject({ success: true });
      release(); await browser.waitFor(text('Pedido alterado por outra operação'), 45000);
      expect(await browser.evaluate(text('Nenhuma transição disponível'))).toBe(true);
      expect(await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: 'CANCELLED', trackingCode: null, version: 2 });
      expect(await prisma.orderStatusHistory.count({ where: { orderId: o.id } })).toBe(2);
    } finally { release(); heldOrder = null; }
  }, 120000);
});
