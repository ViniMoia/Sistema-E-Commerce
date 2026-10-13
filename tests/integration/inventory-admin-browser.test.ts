import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let productId: string, redId: string, blueId: string;
const panel = 'section[aria-label="Ajuste de estoque"]';
async function fill(selector: string, value: string) {
  await browser.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}
async function register(quantity: string) {
  await fill(`${panel} input[type="number"]`, quantity);
  await fill(`${panel} input:not([type])`, 'Conferência física de teste');
  await browser.click('Registrar ajuste');
}
const displayedStock = (id: string) => `document.querySelector('[data-variant-id="${id}"] td')?.textContent`;

beforeAll(async () => {
  await verifyTestDatabase();
  const lojaID = await createFixtureStore();
  const admin = await prisma.user.create({ data: { lojaID, name: 'Admin estoque', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } });
  const product = await prisma.product.create({ data: { lojaID, userID: admin.id, name: 'Produto estoque', description: 'Produto para teste isolado', imageUrl: 'https://example.invalid/product.png', price: 49.9, stock: 7,
    productVariants: { create: [{ size: 'Pequeno', color: 'Vermelho', stock: 3 }, { size: 'Médio', color: 'Azul', stock: 4 }] } }, include: { productVariants: true } });
  productId = product.id;
  redId = product.productVariants.find(v => v.color === 'Vermelho')!.id;
  blueId = product.productVariants.find(v => v.color === 'Azul')!.id;
  const session = await prisma.session.create({ data: { userId: admin.id, expiresAt: new Date(Date.now() + 3600000) } });
  const loja = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } });
  browser = await isolatedBrowser({ host: loja.slug + '.plataforma.com' });
  await browser.send('Network.setCookie', { name: 'session_id', value: session.id, url: browser.origin, httpOnly: true });
}, 120000);
afterAll(async () => {
  if (browser) await browser.close();
  await cleanupFixtureStores();
  await prisma.$disconnect();
}, 30000);

describe('Inventory editor in the browser', () => {
  it('adjusts each variant and the general limit independently, synchronizes fields and preserves catalog drafts', async () => {
    await browser.navigate(`/admin/products/${productId}/edit`);
    await browser.waitFor(`${displayedStock(redId)} === '3'`);
    await fill('input[name="name"]', 'Nome ainda não salvo');
    await fill('input[name="price"]', '59.9');
    await browser.evaluate(`document.querySelector('[data-variant-id="${redId}"] button').click()`);
    await browser.waitFor(`document.querySelector('${panel} select').value === '${redId}'`);
    expect(await browser.evaluate(`document.activeElement === document.querySelector('${panel} input[type="number"]')`)).toBe(true);
    await register('12');
    await browser.waitFor(`${displayedStock(redId)} === '12'`);
    expect(await browser.evaluate(`document.querySelector('input[name="stock"]').value`)).toBe('7');
    expect(await browser.evaluate(`document.querySelector('input[name="name"]').value`)).toBe('Nome ainda não salvo');
    expect(await browser.evaluate(`document.querySelector('input[name="price"]').value`)).toBe('59.9');
    expect(await browser.evaluate(`Array.from(document.querySelectorAll('input[name$=".stock"]')).map(e => e.value).sort()`)).toEqual(['12', '4']);

    await browser.waitFor(`!document.querySelector('[data-variant-id="${blueId}"] button').disabled`);
    await browser.evaluate(`document.querySelector('[data-variant-id="${blueId}"] button').click()`);
    await browser.waitFor(`document.querySelector('${panel} select').value === '${blueId}'`);
    await register('8');
    await browser.waitFor(`${displayedStock(blueId)} === '8'`);
    await browser.waitFor(`!document.querySelector('${panel} select').disabled`);
    await browser.evaluate(`(() => { const select = document.querySelector('${panel} select'); select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await browser.waitFor(`document.querySelector('${panel} select').value === ''`);
    await register('20');
    await browser.waitFor(`document.querySelector('input[name="stock"]').value === '20'`);
    const saved = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { productVariants: true } });
    expect(saved.stock).toBe(20);
    expect(saved.name).toBe('Produto estoque');
    expect(Number(saved.price)).toBe(49.9);
    expect(saved.productVariants.find(v => v.id === redId)?.stock).toBe(12);
    expect(saved.productVariants.find(v => v.id === blueId)?.stock).toBe(8);
    expect(await prisma.auditLog.count({ where: { entityId: productId, action: 'INVENTORY_ADJUSTED' } })).toBe(3);
    expect(await browser.evaluate(`document.querySelector('input[name="name"]').value`)).toBe('Nome ainda não salvo');
    await browser.navigate(`/admin/products/${productId}/edit`);
    await browser.waitFor(`${displayedStock(redId)} === '12' && ${displayedStock(blueId)} === '8'`);
    expect(await browser.evaluate(`document.querySelector('input[name="stock"]').value`)).toBe('20');
  }, 120000);
});
