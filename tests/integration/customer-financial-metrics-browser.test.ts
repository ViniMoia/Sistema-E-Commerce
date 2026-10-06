import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';
import { manualRefund } from '@/services/payment/manual-refund.service';
let f: Awaited<ReturnType<typeof createFulfillmentFixture>>;
let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let unavailable = false;
beforeAll(async () => {
  await verifyTestDatabase(); f = await createFulfillmentFixture();
  browser = await isolatedBrowser({ host: f.host, intercept: async ({ url }) =>
    unavailable && url.endsWith('/metrics') ? { status: 503, body: { success: false, error: 'Fixture unavailable' } } : null });
  await browser.send('Network.setCookie', { name: 'session_id', value: f.session.id, url: browser.origin, httpOnly: true });
}, 120000);
afterAll(async () => { if (browser) await browser.close(); await cleanupFixtureStores(); await prisma.$disconnect(); }, 30000);
const text = (s: string) => 'document.body.innerText.toLocaleLowerCase().includes(' + JSON.stringify(s.toLocaleLowerCase()) + ')';
const value = (id: string) => 'document.querySelector(' + JSON.stringify('[data-testid="' + id + '"]') + ')?.textContent';
describe('WF-17: real financial metrics list/profile and refresh in Next/Chrome', () => {
  it('list and profile show100, preserve100 while refund pending, then both reflect confirmed refund0', async () => {
    const o = await f.order('PICKUP'); await browser.navigate('/admin/customers');
    await browser.waitFor(value('customer-list-ltv') + '?.includes("100,00")', 45000);
    await browser.click('Ver Perfil'); await browser.waitFor(value('customer-net-ltv') + '?.includes("100,00")');
    expect(await browser.evaluate(text('LTV líquido reconhecido'))).toBe(true);
    expect(await browser.evaluate(text('1 pedido(s) com valor reconhecido'))).toBe(true);
    await manualRefund({ lojaID: f.lojaID, userId: f.admin.id, orderId: o.id, expectedVersion: 1, commandId: randomUUID(), action: 'REQUEST_REFUND' });
    await browser.evaluate('window.dispatchEvent(new Event("focus"))');
    await browser.waitFor(value('customer-net-ltv') + '?.includes("100,00")');
    await manualRefund({ lojaID: f.lojaID, userId: f.admin.id, orderId: o.id, expectedVersion: 1, commandId: randomUUID(), action: 'CONFIRM_REFUND', bankReference: 'fixture-bank' });
    await browser.evaluate('window.dispatchEvent(new Event("focus"))');
    await browser.waitFor(value('customer-net-ltv') + '?.match(/0,00/) && !' + value('customer-net-ltv') + '?.includes("100,00")');
    expect(await browser.evaluate(value('customer-net-ticket'))).toContain('0,00');
    await browser.click('Voltar à listagem');
    await browser.waitFor(value('customer-list-ltv') + '?.match(/0,00/) && !' + value('customer-list-ltv') + '?.includes("100,00")');
  }, 180000);
  it('legacy missing evidence is explicit in list/profile and never shown as estimated spend', async () => {
    await prisma.order.create({ data: { lojaID: f.lojaID, userID: f.customer.id, status: 'PAID', deliveryType: 'NONE', subtotal: 999, total: 999, shippingCost: 0 } });
    await browser.evaluate('window.dispatchEvent(new Event("focus"))'); await browser.waitFor(text('Base parcial'));
    expect(await browser.evaluate(value('customer-list-ltv'))).not.toContain('999');
    await browser.click('Ver Perfil'); await browser.waitFor(text('Base financeira parcial'));
    expect(await browser.evaluate(value('customer-net-ltv'))).not.toContain('999');
    expect(await browser.evaluate(text('1 pedido(s) sem evidência histórica'))).toBe(true);
  }, 120000);
  it('failed refresh removes old financial panel; retry on focus recovers from backend', async () => {
    unavailable = true; await browser.evaluate('window.dispatchEvent(new Event("focus"))');
    await browser.waitFor(text('Erro de Carregamento'));
    expect(await browser.evaluate(value('customer-net-ltv'))).toBeUndefined();
    unavailable = false; await browser.evaluate('window.dispatchEvent(new Event("focus"))');
    await browser.waitFor(text('Base financeira parcial') + ' && !!(' + value('customer-net-ltv') + ')');
  }, 120000);
});
