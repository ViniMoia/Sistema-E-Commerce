import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
beforeAll(async () => {
  await verifyTestDatabase(); const f = await createFulfillmentFixture();
  const order = await f.order('PICKUP'); await f.order('PICKUP');
  const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: order.id } });
  for (const [type,amount] of [['SETTLED',100],['REFUNDED',20]] as const) await prisma.financialFact.create({ data: {
    orderId: order.id, attemptId: attempt.id, provider: 'MANUAL', factKey: randomUUID(), type, amount, occurredAt: new Date(),
  } });
  await prisma.order.create({ data: { lojaID: f.lojaID, userID: f.customer.id, status: 'PAID', deliveryType: 'PICKUP', subtotal: 999, total: 999 } });
  browser = await isolatedBrowser({ host: f.host });
  await browser.send('Network.setCookie', { name: 'session_id', value: f.session.id, url: browser.origin, httpOnly: true });
}, 120000);
afterAll(async () => { if(browser) await browser.close(); await cleanupFixtureStores(); await prisma.$disconnect(); }, 30000);
const field = (id: string) => 'document.querySelector(' + JSON.stringify('[data-testid="financial-' + id + '"]') + ')?.textContent';
describe('financial dashboard in isolated Next and Chrome', () => {
  it('shows recognition, settlement, refund, composition and partial coverage on desktop and mobile', async () => {
    await browser.navigate('/admin');
    await browser.waitFor(field('allTime-recognizedGross') + '?.includes("200,00")', 60000);
    for (const period of ['today','month','allTime']) {
      expect(await browser.evaluate(field(period+'-recognizedGross'))).toContain('200,00');
      expect(await browser.evaluate(field(period+'-settledGross'))).toContain('100,00');
      expect(await browser.evaluate(field(period+'-confirmedRefunds'))).toContain('20,00');
      expect(await browser.evaluate(field(period+'-netRecognized'))).toContain('180,00');
    }
    expect(await browser.evaluate(field('coverage'))).toContain('1 pedido(s) sem evidência histórica');
    expect(await browser.evaluate(field('composition-merchandiseAfterDiscount'))).toContain('200,00');
    expect(await browser.evaluate('document.body.textContent')).toContain('Períodos pela data de registro');
    expect(await browser.evaluate('document.body.innerText.includes("Caixa efetivamente liquidado")')).toBe(false);
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const panel = 'document.querySelector(\'section[aria-label="Movimentação financeira"]\')';
    await browser.waitFor(panel + '.clientWidth>0 && ' + panel + '.scrollWidth<=' + panel + '.clientWidth');
    expect(await browser.evaluate(field('allTime-netRecognized'))).toContain('180,00');
  }, 120000);
});
