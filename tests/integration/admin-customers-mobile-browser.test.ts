import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let customerId: string;
let orderId: string;
const customerName = 'Cliente com nome completo extenso para conferir acesso ao perfil no celular';
const customerEmail = 'cliente.com.email.extenso.para.validar.quebra.de.linha@example.invalid';
const reads: string[] = [];
const writes: string[] = [];
const row = () => `[data-row-id="${customerId}"]`;

beforeAll(async () => {
  await verifyTestDatabase();
  const f = await createFulfillmentFixture();
  customerId = f.customer.id;
  orderId = (await f.order('PICKUP')).id;
  await prisma.user.update({ where: { id: customerId }, data: { name: customerName, email: customerEmail, phone: '11999999999' } });
  browser = await isolatedBrowser({ host: f.host, intercept: async request => {
    if (request.url.startsWith('/api/admin/customers')) {
      if (request.method === 'GET') reads.push(request.url);
      else writes.push(request.method);
    }
    return null;
  } });
  await browser.send('Network.setCookie', { name: 'session_id', value: f.session.id, url: browser.origin, httpOnly: true });
}, 120000);
afterAll(async () => {
  if (browser) await browser.close();
  await cleanupFixtureStores();
  await prisma.$disconnect();
}, 30000);

describe('Admin customers on mobile', () => {
  it('keeps all customer fields and profile action in width, opens the correct profile and preserves desktop', async () => {
    await browser.navigate('/admin/customers');
    await browser.waitFor(`!!document.querySelector('${row()}')`, 60000);
    for (const width of [320, 390]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      await browser.waitFor(`getComputedStyle(document.querySelector('${row()}')).display === 'grid'`);
      expect(await browser.evaluate(`(() => {
        const row = document.querySelector('${row()}');
        const button = row.querySelector('button').getBoundingClientRect();
        return document.documentElement.scrollWidth <= innerWidth && button.width >= 44 && button.height >= 44 &&
          [...row.querySelectorAll('td')].every(cell => {
            const r = cell.getBoundingClientRect();
            return r.left >= 0 && r.right <= innerWidth && cell.scrollWidth <= cell.clientWidth;
          });
      })()`)).toBe(true);
      const text = await browser.evaluate(`document.querySelector('${row()}').textContent`);
      for (const expected of [customerName, customerEmail, '11999999999', '1 pedido', '100,00', 'Último Pedido', 'Membro Desde', 'Ver Perfil']) {
        expect(text).toContain(expected);
      }
      const point = await browser.evaluate(`(async () => {
        await document.fonts.ready;
        const e = document.querySelector('${row()} button');
        e.scrollIntoView({ block: 'center', behavior: 'instant' });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        return { x, y, reachable: e.contains(document.elementFromPoint(x, y)) };
      })()`);
      expect(point.reachable).toBe(true);
      await browser.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
      await browser.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await browser.waitFor(`document.querySelector('h2')?.textContent === ${JSON.stringify(customerName)} && document.querySelector('[data-testid="customer-net-ltv"]')?.textContent.includes('100,00')`, 60000);
      expect(reads).toContain('/api/admin/customers/' + customerId);
      expect(reads).toContain('/api/admin/customers/' + customerId + '/metrics');
      // The opt-in card layout must not change the profile's order-history table.
      await browser.waitFor(`!!document.querySelector('[data-row-id="${orderId}"]')`);
      expect(await browser.evaluate(`getComputedStyle(document.querySelector('[data-row-id="${orderId}"]')).display`)).toBe('table-row');
      await browser.click('Voltar à listagem');
      await browser.waitFor(`!document.querySelector('[aria-label="Fechar painel"]') && !!document.querySelector('${row()}')`);
    }
    expect(writes).toEqual([]);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: customerId } })).toMatchObject({ name: customerName, email: customerEmail });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: 'PAID', version: 1 });
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.waitFor(`getComputedStyle(document.querySelector('${row()}')).display === 'table-row'`);
    expect(await browser.evaluate('getComputedStyle(document.querySelector("thead")).display')).toBe('table-header-group');
  }, 120000);
});
