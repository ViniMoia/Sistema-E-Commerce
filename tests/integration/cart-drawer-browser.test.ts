import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { addToCart } from '@/services/cart.service';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let lojaID: string, userID: string;
let readGate: Promise<void> | null = null;
let releaseRead: (() => void) | undefined;
let heldReads = 0;
let readUnavailable = false;
const checkoutButton = '[...document.querySelectorAll("[role=dialog][data-state=open] button")].find(e => e.textContent.includes("Finalizar Compra"))';
const continueButton = '[...document.querySelectorAll("[role=dialog][data-state=open] button")].find(e => e.textContent.includes("Continue Shopping"))';
const drawerOpen = '!!document.querySelector("[role=dialog][data-state=open]")';

function holdReads() {
  heldReads = 0;
  readGate = new Promise<void>(resolve => { releaseRead = resolve; });
}
function resumeReads() {
  readGate = null;
  releaseRead?.();
  releaseRead = undefined;
}
async function openCart() {
  await browser.evaluate('document.querySelector(\'button[aria-label^="Carrinho de compras"]\').click()');
  await browser.waitFor(drawerOpen);
}
async function footerState() {
  return browser.evaluate(`(() => {
    const checkout = ${checkoutButton};
    const keepShopping = ${continueButton};
    if (!checkout || !keepShopping) return null;
    const footer = checkout.closest('.space-y-6').parentElement;
    const rect = footer.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, visible: rect.top >= 0 && rect.bottom <= innerHeight,
      checkoutDisabled: checkout.disabled, continueDisabled: keepShopping.disabled };
  })()`) as Promise<{ top: number; bottom: number; visible: boolean; checkoutDisabled: boolean; continueDisabled: boolean } | null>;
}
async function createItem(name: string) {
  const product = await prisma.product.create({ data: { lojaID, userID, name, description: '', imageUrl: '', price: 49.90, stock: 10,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 10 } } }, include: { productVariants: true } });
  await addToCart(userID, { productID: product.id, variantID: product.productVariants[0].id, quantity: 1, commandId: randomUUID() }, lojaID);
}

beforeAll(async () => {
  await verifyTestDatabase();
  lojaID = await createFixtureStore();
  userID = (await prisma.user.create({ data: { lojaID, name: 'Cliente carrinho', email: randomUUID() + '@example.invalid', password: '' } })).id;
  await createItem('Produto carrinho 1');
  const session = await prisma.session.create({ data: { userId: userID, expiresAt: new Date(Date.now() + 3600000) } });
  const loja = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } });
  browser = await isolatedBrowser({ host: loja.slug + '.plataforma.com', intercept: async ({ url, method }) => {
    if (url !== '/api/cart' || method !== 'GET') return null;
    if (readGate) { heldReads++; await readGate; }
    return readUnavailable ? { status: 503, body: { error: 'Fixture cart unavailable' } } : null;
  } });
  await browser.send('Network.setCookie', { name: 'session_id', value: session.id, url: browser.origin, httpOnly: true });
}, 120000);

afterAll(async () => {
  resumeReads();
  if (browser) await browser.close();
  await cleanupFixtureStores();
  await prisma.$disconnect();
}, 30000);

afterEach(async () => {
  resumeReads();
  readUnavailable = false;
  if (browser) {
    await browser.evaluate(`(${continueButton})?.click()`);
    await browser.waitFor('!' + drawerOpen);
  }
});

describe('Cart drawer: stable actions during real HTTP revalidation', () => {
  it('keeps totals and actions visible on opening/focus, blocks checkout during pending/error reads and allows closing', async () => {
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.navigate('/');
    await browser.waitFor('(() => { const button = document.querySelector(\'button[aria-label="Carrinho de compras (1 item)"]\'); const key = button && Object.keys(button).find(k => k.startsWith("__reactProps")); return key && typeof button[key].onClick === "function"; })()');
    await openCart();
    await browser.waitFor(`!!(${checkoutButton}) && !(${checkoutButton}).disabled`);
    const ready = await footerState();
    expect(ready).toMatchObject({ visible: true, checkoutDisabled: false, continueDisabled: false });
    await browser.click('Continue Shopping');
    await browser.waitFor('!' + drawerOpen);

    holdReads();
    await openCart();
    await expect.poll(() => heldReads).toBeGreaterThan(0);
    const opening = await footerState();
    expect(opening).toMatchObject({ visible: true, checkoutDisabled: true, continueDisabled: false });
    expect(Math.abs(opening!.top - ready!.top)).toBeLessThan(1);
    expect(Math.abs(opening!.bottom - ready!.bottom)).toBeLessThan(1);
    expect(await browser.evaluate(`(${checkoutButton}).closest('.space-y-6').textContent`)).toMatch(/49[,.]90/);
    await browser.evaluate(`(${checkoutButton}).click()`);
    expect(await browser.evaluate('location.pathname')).toBe('/');
    resumeReads();
    await browser.waitFor(`!(${checkoutButton}).disabled`);

    holdReads();
    await browser.evaluate('window.dispatchEvent(new Event("focus"))');
    await expect.poll(() => heldReads).toBeGreaterThan(0);
    expect(await footerState()).toMatchObject({ visible: true, checkoutDisabled: true, continueDisabled: false });
    await browser.click('Continue Shopping');
    await browser.waitFor('!' + drawerOpen);
    resumeReads();
    await openCart();
    await browser.waitFor(`!(${checkoutButton}).disabled`);

    readUnavailable = true;
    await browser.evaluate('window.dispatchEvent(new Event("focus"))');
    await browser.waitFor('document.querySelector("[role=alert]")?.innerText.includes("Não foi possível carregar o carrinho")');
    expect(await footerState()).toMatchObject({ visible: true, checkoutDisabled: true, continueDisabled: false });
    readUnavailable = false;
    await browser.click('Tentar novamente');
    await browser.waitFor(`!(${checkoutButton}).disabled`);
    expect(await prisma.order.count({ where: { lojaID } })).toBe(0);
    await browser.click('Continue Shopping');
    await browser.waitFor('!' + drawerOpen);
  }, 120000);

  it('keeps the footer inside a mobile viewport with a scrollable long cart and enables checkout after refresh', async () => {
    for (let index = 2; index <= 7; index++) await createItem('Produto carrinho ' + index);
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 700, deviceScaleFactor: 1, mobile: true });
    await browser.navigate('/');
    await browser.waitFor('!!document.querySelector(\'button[aria-label="Carrinho de compras (7 itens)"]\')');
    holdReads();
    await openCart();
    await expect.poll(() => heldReads).toBeGreaterThan(0);
    expect(await footerState()).toMatchObject({ visible: true, checkoutDisabled: true, continueDisabled: false });
    const before = await footerState();
    expect(await browser.evaluate(`(() => {
      const viewport = document.querySelector('[role=dialog][data-state=open] [data-radix-scroll-area-viewport]');
      viewport.scrollTop = viewport.scrollHeight;
      return viewport.scrollHeight > viewport.clientHeight && viewport.scrollTop > 0;
    })()`)).toBe(true);
    expect((await footerState())!.top).toBe(before!.top);
    resumeReads();
    await browser.waitFor(`!(${checkoutButton}).disabled`);
    await browser.click('Finalizar Compra');
    await browser.waitFor('location.pathname === "/checkout"');
    expect(await prisma.order.count({ where: { lojaID } })).toBe(0);
  }, 120000);
});
