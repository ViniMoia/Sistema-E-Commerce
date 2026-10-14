import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { addToCart } from '@/services/cart.service';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

let host: string, sessionId: string;
const browsers: Awaited<ReturnType<typeof isolatedBrowser>>[] = [];
const ctaReady = `(() => { const a = [...document.querySelectorAll('a')].find(e => e.textContent.includes('Explorar Catálogo'));
  return !!a && a.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) && !!document.querySelector('#catalogo h4 button'); })()`;
const hydrated = `(() => { const b = document.querySelector('button[aria-label^="Carrinho de compras"]');
  const key = b && Object.keys(b).find(k => k.startsWith('__reactProps')); return key && typeof b[key].onClick === 'function'; })()`;

beforeAll(async () => {
  await verifyTestDatabase();
  const lojaID = await createFixtureStore();
  const user = await prisma.user.create({ data: { lojaID, name: 'Leitor de prontidão', email: randomUUID() + '@example.invalid', password: '' } });
  const product = await prisma.product.create({ data: { lojaID, userID: user.id, name: 'CERA PRONTIDAO', description: 'Produto de teste',
    price: 100, stock: 20, imageUrl: '/brands/wap.svg', productVariants: { create: { size: 'Único', color: 'Padrão', stock: 20 } } }, include: { productVariants: true } });
  await addToCart(user.id, { productID: product.id, variantID: product.productVariants[0].id, quantity: 1, commandId: randomUUID() }, lojaID);
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 3600000) } });
  sessionId = session.id;
  host = (await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug + '.plataforma.com';
}, 120000);
afterEach(async () => {
  for (const browser of browsers.splice(0)) await browser.close();
}, 60000);
afterAll(async () => {
  await cleanupFixtureStores(); await prisma.$disconnect();
}, 60000);

describe('V-01/V-02: conteúdo independente de vídeo e prontidão dos quatro fluxos', () => {
  it('entrega texto e links visíveis mesmo sem executar JavaScript', async () => {
    const browser = await isolatedBrowser({ host }); browsers.push(browser);
    await browser.send('Emulation.setScriptExecutionDisabled', { value: true });
    await browser.navigate('/'); await browser.waitFor(ctaReady);
    expect(await browser.evaluate('document.querySelector("video").getAttribute("src")')).toBeNull();
    const headings = await browser.evaluate(`Array.from(document.querySelectorAll('h1'), e => ({
      text: e.textContent, visible: e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),
      ancestors: Array.from((function*(){ let n=e; while(n){ yield n; n=n.parentElement; } })(), n => ({
        tag:n.tagName, hidden:n.hidden, display:getComputedStyle(n).display,
        visibility:getComputedStyle(n).visibility, opacity:getComputedStyle(n).opacity
      }))
    }))`);
    expect(headings[0]?.visible, JSON.stringify(headings)).toBe(true);
    expect(headings[0].ancestors.every((ancestor: { opacity: string }) => ancestor.opacity === '1'), JSON.stringify(headings)).toBe(true);
    // This assertion intentionally runs before hydration, but the next case
    // must not overlap a still-loading page and the dev compiler it started.
    await browser.waitFor('document.readyState === "complete"');
  }, 60000);
  it.each([{ name: 'desktop', width: 1280, height: 900, mobile: false }, { name: 'mobile', width: 390, height: 844, mobile: true }])('$name: home, produto, carrinho e checkout com mídia externa bloqueada', async device => {
    const browser = await isolatedBrowser({ host }); browsers.push(browser);
    await browser.send('Emulation.setDeviceMetricsOverride', { width: device.width, height: device.height, mobile: device.mobile, deviceScaleFactor: 1 });
    await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await browser.send('Network.setCookie', { name: 'session_id', value: sessionId, url: browser.origin, httpOnly: true });
    const navigationEvents: unknown[] = [];
    browser.on('Network.requestWillBeSent', (event: { request: { url: string; headers: Record<string,string> } }) => {
      const url = new URL(event.request.url);
      if (url.pathname === '/' || url.pathname === '/checkout') navigationEvents.push({ at: Date.now(), path: url.pathname,
        rsc: event.request.headers.RSC, prefetch: event.request.headers['Next-Router-Prefetch'] });
    });
    const samples: Record<string, number[]> = { home: [], product: [], cart: [], checkout: [] };
    for (let index = 0; index < 5; index++) {
      await browser.send('Network.setCacheDisabled', { cacheDisabled: index === 0 });
      let start = performance.now();
      await browser.navigate('/'); await browser.waitFor(ctaReady); await browser.waitFor(hydrated);
      samples.home.push(performance.now() - start);
      await browser.waitFor('document.querySelector("video").getAttribute("src") === null');
      start = performance.now();
      await browser.evaluate('document.querySelector("#catalogo h4 button").click()');
      await browser.waitFor('document.querySelector(\'button[aria-label="Comprar Agora"]\')?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})');
      samples.product.push(performance.now() - start);
      start = performance.now();
      await browser.evaluate('document.querySelector(\'button[aria-label^="Carrinho de compras"]\').click()');
      await browser.waitFor('(() => { const d = document.querySelector("[role=dialog][data-state=open]"); return !!d && d.innerText.includes("CERA PRONTIDAO") && !d.querySelector(".animate-spin"); })()');
      samples.cart.push(performance.now() - start);
      start = performance.now();
      // A focus refresh can overlap the move from the product view to checkout.
      // Exercise that boundary instead of waiting for all background reads.
      await browser.evaluate('window.dispatchEvent(new Event("focus")); [...document.querySelectorAll("[role=dialog][data-state=open] button")].find(e => e.textContent.includes("Finalizar Compra")).click()');
      try {
        await browser.waitFor('location.pathname === "/checkout" && !!document.querySelector("input[name=name]") && document.querySelector("fieldset")?.disabled === false');
      } catch (error) {
        console.log('[navigation-diagnostic] ' + JSON.stringify({ device, index, navigationEvents,
          path: await browser.evaluate('location.pathname') }));
        throw error;
      }
      samples.checkout.push(performance.now() - start);
    }
    const metrics = Object.fromEntries(Object.entries(samples).map(([name, values]) => {
      const warm = values.slice(1).sort((a, b) => a - b);
      return [name, { firstMs: values[0], warmP95Ms: warm[Math.ceil(warm.length * .95) - 1], samples: values.length }];
    }));
    console.log('[storefront-readiness] ' + JSON.stringify({ device, browser: browser.browserIdentity, metrics, network: 'loopback', externalMedia: 'blocked',
      runtime: process.env.TEST_APP_RUNTIME ?? 'development', coldScope: 'fresh browser cache, not Cloud Run cold start', productionReady: false }));
    if (process.env.TEST_APP_RUNTIME === 'production') {
      for (const metric of Object.values(metrics)) { expect(metric.firstMs).toBeLessThanOrEqual(5000); expect(metric.warmP95Ms).toBeLessThanOrEqual(3000); }
    }
  }, 120000);
});
