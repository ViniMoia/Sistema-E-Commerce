import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let storeId: string;
let selected: { id: string; orderNumber: number };
const labels = { PENDING: 'Pendente', PAID: 'Pago', SHIPPED: 'Enviado', DELIVERED: 'Entregue', CANCELLED: 'Cancelado' } as const;
const writes: string[] = [];
const detailReads: string[] = [];
const customerName = 'Cliente com nome longo para conferência de apresentação no celular';

beforeAll(async () => {
  await verifyTestDatabase();
  const f = await createFulfillmentFixture();
  storeId = f.lojaID;
  await prisma.user.update({ where: { id: f.customer.id }, data: {
    name: customerName,
    email: 'cliente.com.endereco.extenso.para.validar.quebra.de.linha@example.invalid',
  } });
  for (const status of Object.keys(labels) as Array<keyof typeof labels>) {
    const order = await prisma.order.create({ data: {
      lojaID: f.lojaID, userID: f.customer.id, status,
      subtotal: 49.9, total: 49.9, deliveryType: status === 'SHIPPED' ? 'DELIVERY' : 'PICKUP',
    } });
    if (status === 'PAID') selected = order;
  }
  browser = await isolatedBrowser({ host: f.host, intercept: async request => {
    if (request.url.startsWith('/api/admin/orders')) {
      if (request.method !== 'GET') writes.push(request.method);
      else detailReads.push(request.url);
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

describe('Admin order list on mobile', () => {
  it('shows every status, total and customer without horizontal scrolling and opens the selected order', async () => {
    await browser.navigate('/admin/orders');
    await browser.waitFor('document.querySelectorAll("[data-order-id]").length === 5', 60000);
    for (const width of [320, 390]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      await browser.waitFor('getComputedStyle(document.querySelector("[data-order-id]")).display === "grid"');
      expect(await browser.evaluate(`(() => {
        const rows = [...document.querySelectorAll('[data-order-id]')];
        return document.documentElement.scrollWidth <= innerWidth && rows.every(row =>
          [...row.querySelectorAll('td')].every(cell => {
            const r = cell.getBoundingClientRect();
            return r.left >= 0 && r.right <= innerWidth && cell.scrollWidth <= cell.clientWidth;
          }) && (() => { const r = row.querySelector('button').getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })());
      })()`)).toBe(true);
      for (const [status, label] of Object.entries(labels)) {
        expect(await browser.evaluate(`document.querySelector('[data-order-status="${status}"]').textContent`)).toContain(label);
      }
      const rowText = await browser.evaluate(`document.querySelector('[data-order-id="${selected.id}"]').textContent`);
      expect(rowText).toContain('49,90');
      expect(rowText).toContain(customerName);
      expect(rowText).toContain('Balcão');
    }
    const point = await browser.evaluate(`(() => {
      const e = document.querySelector('[data-order-id="${selected.id}"] button');
      e.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      return { x, y, reachable: e.contains(document.elementFromPoint(x, y)) };
    })()`);
    expect(point.reachable).toBe(true);
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: point.x, y: point.y });
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: point.x, y: point.y });
    await browser.waitFor(`document.querySelector('[role="dialog"] h2')?.textContent === 'Detalhes do Pedido #${selected.orderNumber}'`, 60000);
    expect(detailReads).toContain('/api/admin/orders/' + selected.id);
    expect(writes).toEqual([]);
    expect(await prisma.order.count({ where: { lojaID: storeId } })).toBe(5);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: selected.id } })).toMatchObject({ status: 'PAID', version: 0 });
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.navigate('/admin/orders');
    await browser.waitFor('document.querySelectorAll("[data-order-id]").length === 5');
    expect(await browser.evaluate('getComputedStyle(document.querySelector("[data-order-id]")).display')).toBe('table-row');
    expect(await browser.evaluate('getComputedStyle(document.querySelector("thead")).display')).toBe('table-header-group');
  }, 120000);
});
