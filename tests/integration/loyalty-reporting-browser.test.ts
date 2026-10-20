import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';
import { get } from '@/tests/helpers/request';

let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let f: Awaited<ReturnType<typeof createFulfillmentFixture>>;
beforeAll(async () => {
  await verifyTestDatabase(); f = await createFulfillmentFixture();
  await prisma.loja.update({ where: { id: f.lojaID }, data: { loyaltyPointValue: '0.50' } });
  const order = await prisma.order.create({ data: { lojaID: f.lojaID, userID: f.customer.id, deliveryType: 'PICKUP', subtotal: 100, total: 100 } });
  for (const [type, points, monetaryValue] of [['REDEEM',-100,1],['REFUND_REDEEM',40,0.4],['REDEEM',-5,null]] as const) {
    await prisma.loyaltyTransaction.create({ data: { lojaID: f.lojaID, userID: f.customer.id, orderId: order.id, type, points, monetaryValue, balanceAfter: 0, description: 'Fixture comercial' } });
  }
  const test = await prisma.order.create({ data: { lojaID: f.lojaID, userID: f.customer.id, deliveryType: 'PICKUP', subtotal: 100, total: 100,
    reportingExclusion: { create: { reason: 'USER_CLASSIFIED_TEST_DATA', classificationBatch: randomUUID(), classifiedBy: f.admin.id } } } });
  await prisma.loyaltyTransaction.create({ data: { lojaID: f.lojaID, userID: f.customer.id, orderId: test.id, type: 'REDEEM', points: -500, monetaryValue: 50, balanceAfter: 0, description: 'Fixture teste preservada' } });
  browser = await isolatedBrowser({ host: f.host });
  await browser.send('Network.setCookie', { name: 'session_id', value: f.session.id, url: browser.origin, httpOnly: true });
}, 120000);
afterAll(async () => { if (browser) await browser.close(); await cleanupFixtureStores(); await prisma.$disconnect(); }, 30000);
const panel = 'document.querySelector(\'[data-testid="loyalty-commercial-summary"]\')';
// Server-rendered text can be visible before React attaches the click handler.
// Keep this readiness check in the browser fixture, as in catalog navigation.
const clickReady = (element: string) => `(() => {
  const button = ${element};
  const key = button && Object.keys(button).find(key => key.startsWith('__reactProps'));
  return key && typeof button[key].onClick === 'function';
})()`;
const openMenu = 'document.querySelector(\'button[aria-label="Abrir menu admin"]\')';
describe('loyalty reporting on authenticated pages', () => {
  it('report and dashboard share historical amounts and partial warning, including mobile and preserved test history', async () => {
    const headers = { host: f.host, cookie: `session_id=${f.session.id}` };
    const response = await get('/api/admin/loyalty/reports', { headers });
    expect(response.status).toBe(200);
    expect(response.headers?.['cache-control']).toContain('no-store');
    expect(response.body).toMatchObject({ data: { metrics: { totalRedeemedMonetaryValue: 1, commercial: { redeemedPoints: 105, returnedPoints: 40, netRedeemedValue: 0.6, missingMonetaryValues: 1, coverage: 'PARTIAL' } } } });
    for (const path of ['/admin/fidelidade','/admin']) {
      await browser.navigate(path);
      await browser.waitFor(panel + '?.textContent.includes("Resgates devolvidos")', 60000);
      const text = await browser.evaluate(panel + '.textContent');
      for (const expected of ['1,00','0,40','0,60','105 pts','40 pts','65 pts','Apuração parcial']) expect(text).toContain(expected);
      await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await browser.waitFor(panel + '.clientWidth>0 && ' + panel + '.scrollWidth<=' + panel + '.clientWidth');
      await browser.evaluate('window.scrollTo(0, 0)');
      expect(await browser.evaluate(`(() => {
        const menu = document.querySelector('button[aria-label="Abrir menu admin"]').getBoundingClientRect();
        const main = document.querySelector('main').getBoundingClientRect();
        return menu.width > 0 && menu.bottom <= main.top && document.documentElement.scrollWidth <= innerWidth;
      })()`)).toBe(true);
      await browser.waitFor(clickReady(openMenu));
      await browser.evaluate(openMenu + '.click()');
      await browser.waitFor('document.querySelector(\'button[aria-label="Abrir menu admin"]\').getAttribute("aria-expanded") === "true"');
      await browser.evaluate('document.querySelector(\'button[aria-label="Fechar menu"]\').click()');
      await browser.waitFor('document.querySelector(\'button[aria-label="Abrir menu admin"]\').getAttribute("aria-expanded") === "false"');
    }
    await browser.navigate('/admin/fidelidade');
    await browser.waitFor(panel + '?.textContent.includes("Resgates devolvidos")', 60000);
    const ledgerButton = 'Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Últimas Movimentações"))';
    await browser.waitFor(clickReady(ledgerButton));
    await browser.evaluate(ledgerButton + '.click()');
    await browser.waitFor('document.body.textContent.includes("Pedido de teste")');
    expect(await prisma.loyaltyTransaction.count({ where: { lojaID: f.lojaID } })).toBe(4);
    expect(await prisma.loyaltyWallet.count({ where: { lojaID: f.lojaID } })).toBe(0);
  }, 120000);
});
