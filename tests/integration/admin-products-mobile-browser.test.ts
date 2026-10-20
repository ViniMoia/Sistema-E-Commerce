import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let productId: string;
let deleteRequests = 0;
const productName = 'Hidratante para couro com descrição longa e identificação da embalagem 500ML';
const row = () => `[data-product-id="${productId}"]`;

// Use pointer input at the visible element so off-screen/covered actions fail.
async function press(selector: string) {
  const point = await browser.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { x, y, reachable: e.contains(document.elementFromPoint(x, y)) };
  })()`);
  expect(point.reachable).toBe(true);
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: point.x, y: point.y });
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: point.x, y: point.y });
}

beforeAll(async () => {
  await verifyTestDatabase();
  const f = await createFulfillmentFixture();
  const product = await prisma.product.create({ data: {
    lojaID: f.lojaID, userID: f.admin.id, name: productName, description: productName,
    imageUrl: '', price: 49.9, stock: 7,
    productVariants: { create: [
      { size: 'Pequeno', color: 'Vermelho', stock: 3 },
      { size: 'Médio', color: 'Azul', stock: 4 },
    ] },
  } });
  productId = product.id;
  browser = await isolatedBrowser({ host: f.host, intercept: async request => {
    if (request.method === 'DELETE') deleteRequests++;
    return null;
  } });
  await browser.send('Network.setCookie', { name: 'session_id', value: f.session.id, url: browser.origin, httpOnly: true });
}, 120000);
afterAll(async () => {
  if (browser) await browser.close();
  await cleanupFixtureStores();
  await prisma.$disconnect();
}, 30000);

describe('Admin product actions on mobile', () => {
  it('exposes edit/delete without horizontal scrolling, keeps confirmation and opens the correct editor', async () => {
    await browser.navigate('/admin/products');
    await browser.waitFor(`!!document.querySelector('${row()}')`, 60000);
    for (const width of [320, 390]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      await browser.waitFor(`getComputedStyle(document.querySelector('${row()}')).display === 'grid'`);
      expect(await browser.evaluate(`(() => {
        const row = document.querySelector('${row()}');
        const controls = [...row.querySelectorAll('a, button')];
        return document.documentElement.scrollWidth <= innerWidth && controls.length === 2 &&
          controls.every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width >= 44 && r.height >= 44; });
      })()`)).toBe(true);
      expect(await browser.evaluate(`document.querySelector('${row()}').textContent`)).toContain('7 un.');
      expect(await browser.evaluate(`document.querySelector('${row()}').textContent`)).toContain('Vermelho (3)');
      await press(`${row()} button[title="Excluir Produto"]`);
      await browser.waitFor('!!document.querySelector(\'[role="dialog"]\')');
      expect(await browser.evaluate('document.querySelector(\'[role="dialog"]\').textContent')).toContain(productName);
      expect(await browser.evaluate(`[...document.querySelectorAll('[role="dialog"] button')].every(e => {
        const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth;
      })`)).toBe(true);
      expect(deleteRequests).toBe(0);
      await press('[role="dialog"] button');
      await browser.waitFor('!document.querySelector(\'[role="dialog"]\')');
    }
    await press(`${row()} a[title="Editar Produto"]`);
    await browser.waitFor(`location.pathname === '/admin/products/${productId}/edit' && !!document.querySelector('input[name="name"]')`, 60000);
    expect(await browser.evaluate('document.querySelector(\'input[name="name"]\').value')).toBe(productName);
    expect(await prisma.productVariants.count({ where: { ProductID: productId } })).toBe(2);
    expect(await prisma.product.count({ where: { id: productId } })).toBe(1);
    expect(deleteRequests).toBe(0);
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.navigate('/admin/products');
    await browser.waitFor(`!!document.querySelector('${row()}')`);
    expect(await browser.evaluate(`getComputedStyle(document.querySelector('${row()}')).display`)).toBe('table-row');
    expect(await browser.evaluate('getComputedStyle(document.querySelector("thead")).display')).toBe('table-header-group');
  }, 120000);
});
