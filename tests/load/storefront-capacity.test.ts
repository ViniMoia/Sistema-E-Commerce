import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { productionOrigins, productionRequest as request } from '@/tests/helpers/production-request';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

// User estimates supplied on 06/10; timing bounds refer to complete pages.
// Fixed pilot: HTTP virtual users drive the server; ONE real browser samples UI.
// This is not 80 devices, a Vercel/Neon certificate, or real Asaas checkout.
const durationMs = 120_000;
const thinkTimeMs = 5_000; // Pilot assumption, not inferred from visitors/day.
const stock = 200;
type Headers = Record<string, string>;
type Buyer = { id: string; name: string; email: string; headers: Headers };
type Metric = { route: string; elapsedMs: number; status: number };
type PageMetric = { page: string; readyMs: number; loadMs: number; lcpMs: number | null; externalMediaExcluded: boolean };
let lojaID: string, host: string, productID: string, variantID: string;
let browsers: Awaited<ReturnType<typeof isolatedBrowser>>[] = [];
let buyers: Buyer[] = [];
const expectedOrderIds = new Set<string>();
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
function summarize(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return { count: sorted.length, p50Ms: sorted[Math.ceil(sorted.length * .5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1)! };
}
async function newBuyer(): Promise<Buyer> {
  const user = await prisma.user.create({ data: { lojaID, name: 'Cliente de carga', email: randomUUID() + '@example.invalid', password: '' } });
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } });
  return { ...user, headers: { Host: host, Cookie: 'session_id=' + session.id } };
}
const pageInstrumentation = String.raw`
  window.__capacity = { readyMs: null, lcpMs: null };
  new PerformanceObserver(list => {
    const entries = list.getEntries();
    if (entries.length) window.__capacity.lcpMs = entries[entries.length - 1].startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  function pollReady() {
    let ready = document.readyState === 'complete' && document.fonts.status === 'loaded';
    if (location.pathname === '/') {
      const h1 = document.querySelector('h1');
      const cta = [...document.querySelectorAll('a')].find(e => e.textContent.includes('Explorar Catálogo'));
      ready = ready && !!h1 && getComputedStyle(h1).visibility === 'visible'
        && !!cta && Number(getComputedStyle(cta.parentElement).opacity) >= .99
        && !!document.querySelector('#catalogo') && document.body.innerText.includes('CERA CARGA');
    } else if (location.pathname === '/checkout') {
      ready = ready && !!document.querySelector('input[name="name"]')
        && !!document.querySelector('fieldset') && !document.querySelector('fieldset').disabled;
    } else ready = false;
    const visibleImages = [...document.images].filter(image => {
      const r = image.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0 && r.height > 0;
    });
    ready = ready && visibleImages.every(image => image.complete && image.naturalWidth > 0);
    if (ready) window.__capacity.readyMs = performance.now();
    else requestAnimationFrame(pollReady);
  }
  requestAnimationFrame(pollReady);
`;

beforeAll(async () => {
  if (process.env.TEST_CAPACITY_RUN !== 'true') throw new Error('Use npm run test:capacity:isolated.');
  productionOrigins(); await verifyTestDatabase(); lojaID = await createFixtureStore();
  const loja = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } }); host = loja.slug + '.plataforma.com';
  const admin = await prisma.user.create({ data: { lojaID, name: 'Admin fixture', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } });
  for (let index = 0; index < 36; index++) {
    const product = await prisma.product.create({ data: { lojaID, userID: admin.id, name: 'CERA CARGA ' + index,
      description: 'Fixture sintética de capacidade', imageUrl: '/brands/wap.svg', price: 100, stock,
      productVariants: { create: { size: 'Único', color: 'Padrão', stock } } }, include: { productVariants: true } });
    if (!index) { productID = product.id; variantID = product.productVariants[0].id; }
  }
  buyers = [];
  for (let index = 0; index < 80; index++) {
    const buyer = await newBuyer(); buyers.push(buyer);
    await prisma.cart.create({ data: { lojaID, userID: buyer.id, items: { create: {
      productID, variantID, quantity: 1, price: 100, productName: 'CERA CARGA 0', imageUrl: '/brands/wap.svg', color: 'Padrão', size: 'Único',
    } } } });
  }
}, 120_000);
afterAll(async () => {
  for (const browser of browsers) await browser.close();
  browsers = [];
  await cleanupFixtureStores(); await prisma.$disconnect();
}, 60_000);

async function runProfile(users: number, checkoutsPerMinute: number, targetMs: number) {
  const metrics: Metric[] = [], pages: PageMetric[] = [], flowMs: number[] = [], launchLagMs: number[] = [];
  let failures = 0, inFlight = 0, maxInFlight = 0;
  const timed = async (instance: 0 | 1, method: string, route: string, body: unknown, headers: Headers) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      const result = await request(instance, method, route, body, headers);
      metrics.push({ route, elapsedMs: result.elapsedMs, status: result.status });
      if (result.status < 200 || result.status >= 300) failures++;
      return result;
    } catch { failures++; throw new Error('CAPACITY_REQUEST_FAILED'); }
    finally { inFlight--; }
  };
  const browser = await isolatedBrowser({ host }); browsers.push(browser);
  await browser.send('Network.setCookie', { name: 'session_id', value: buyers[0].headers.Cookie.slice('session_id='.length), url: browser.origin, httpOnly: true });
  await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: pageInstrumentation });
  // Warm-up is excluded from latency samples and is not a cold-start certificate.
  for (const route of ['/', '/api/cart', '/api/products?limit=100']) expect((await request(0, 'GET', route, undefined, buyers[0].headers)).status).toBe(200);
  const start = performance.now();
  async function traffic(buyer: Buyer, index: number) {
    let round = 0;
    const first = start + index * thinkTimeMs / users;
    while (first + round * thinkTimeMs < start + durationMs) {
      const due = first + round * thinkTimeMs; await pause(due - performance.now());
      launchLagMs.push(Math.max(0, performance.now() - due));
      const route = ['/', '/api/products?limit=100', '/api/cart'][(index + round) % 3];
      const result = await timed((index % 2) as 0 | 1, 'GET', route, undefined, buyer.headers);
      expect(result.status).toBe(200);
      if (route === '/') expect(String(result.body)).toContain('CERA CARGA');
      else if (route.startsWith('/api/products')) expect(Array.isArray(result.body) && result.body.length === 36).toBe(true);
      else expect(result.body).toMatchObject({ items: [{ productID, variantID, quantity: 1 }] });
      round++;
    }
  }
  async function checkoutTraffic() {
    const count = durationMs / 60_000 * checkoutsPerMinute;
    for (let index = 0; index < count; index++) {
      await pause(start + index * 60_000 / checkoutsPerMinute - performance.now());
      const buyer = await newBuyer(); const instance = (index % 2) as 0 | 1;
      const flowStarted = performance.now();
      const added = await timed(instance, 'POST', '/api/cart', { productID, variantID, quantity: 1, commandId: randomUUID() }, buyer.headers);
      expect(added.status).toBe(201);
      const cart = added.body as { id: string; version: number };
      const proposal = await timed(instance, 'POST', '/api/checkout/intents', { lojaID, cartID: cart.id, cartVersion: cart.version,
        customer: { name: buyer.name, email: buyer.email, phone: '11999999999', cpfCnpj: '52998224725' },
        items: [{ productId: productID, variantId: variantID, quantity: 1 }], deliveryType: 'PICKUP', paymentMethod: 'WHATSAPP_PIX' }, buyer.headers);
      expect(proposal.status).toBe(200);
      const p = (proposal.body as { data: { checkoutIntentID: string; revision: number; contentHash: string } }).data;
      const accepted = { checkoutIntentID: p.checkoutIntentID, acceptedRevision: p.revision, acceptedContentHash: p.contentHash };
      const completed = await timed(instance, 'POST', '/api/checkout', accepted, buyer.headers); expect(completed.status).toBe(200);
      flowMs.push(performance.now() - flowStarted);
      const orderId = (completed.body as { data: { order: { id: string } } }).data.order.id;
      expect(expectedOrderIds.has(orderId)).toBe(false); expectedOrderIds.add(orderId);
      const replay = await timed((1 - instance) as 0 | 1, 'POST', '/api/checkout', accepted, buyer.headers);
      expect(replay.status).toBe(200); expect(replay.body).toMatchObject({ data: { order: { id: orderId } } });
    }
  }
  async function browserTraffic() {
    let index = 0;
    while (performance.now() < start + durationMs) {
      const page = index++ % 2 ? '/checkout' : '/';
      await browser.navigate(page);
      await browser.waitFor('location.pathname === ' + JSON.stringify(page)
        + ' && window.__capacity?.readyMs !== null && window.__capacity?.readyMs !== undefined', 25_000);
      const measured = await browser.evaluate(`({ page: location.pathname, readyMs: window.__capacity.readyMs,
        loadMs: performance.getEntriesByType('navigation')[0].loadEventEnd,
        lcpMs: window.__capacity.lcpMs, externalMediaExcluded: location.pathname === '/' })`) as PageMetric;
      expect(measured.page).toBe(page); expect(measured.readyMs).toBeGreaterThan(0); expect(measured.loadMs).toBeGreaterThan(0);
      pages.push(measured); await pause(1000);
    }
  }
  // All tasks finish before fixture cleanup, including in the failure case.
  const tasks = await Promise.allSettled([...buyers.slice(0, users).map(traffic), checkoutTraffic(), browserTraffic()]);
  const errors = tasks.filter(task => task.status === 'rejected');
  const count = expectedOrderIds.size;
  await verifyTestDatabase();
  const orders = await prisma.order.findMany({ where: { lojaID }, include: { paymentAttempts: true, items: true } });
  expect(orders).toHaveLength(count);
  for (const order of orders) {
    expect(expectedOrderIds.has(order.id)).toBe(true); expect(order.status).toBe('PENDING');
    expect(order.paymentAttempts).toHaveLength(1); expect(order.paymentAttempts[0].provider).toBe('MANUAL');
    expect(order.items).toHaveLength(1); expect(order.items[0].quantity).toBe(1);
  }
  expect(await prisma.inventoryReservation.count({ where: { order: { lojaID } } })).toBe(count);
  expect(await prisma.commerceOutbox.count({ where: { aggregateId: { in: [...expectedOrderIds] }, commandType: 'CHECKOUT_COMMITTED' } })).toBe(count);
  expect((await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock).toBe(stock - count);
  expect((await prisma.productVariants.findUniqueOrThrow({ where: { id: variantID } })).stock).toBe(stock - count);
  const pageStats = ['/', '/checkout'].map(page => ({ page, readiness: summarize(pages.filter(p => p.page === page).map(p => p.readyMs)),
    loadEvent: summarize(pages.filter(p => p.page === page).map(p => p.loadMs)) }));
  console.log('[capacity] ' + JSON.stringify({ users, checkoutsPerMinute, durationMs, thinkTimeMs, measuredDurationMs: performance.now() - start,
    model: 'paced-http-users-plus-one-browser', warmupExcluded: true, browserCacheDisabled: true,
    maxInFlight, failures, requestLatency: summarize(metrics.map(m => m.elapsedMs)), launchLag: summarize(launchLagMs),
    routes: [...new Set(metrics.map(m => m.route))].map(route => ({ route, timing: summarize(metrics.filter(m => m.route === route).map(m => m.elapsedMs)) })),
    manualCheckoutFlow: summarize(flowMs), pageStats, pageSamples: pages, targetMs,
    localReadinessWithinTarget: pageStats.every(p => p.readiness !== null && p.readiness.p95Ms < targetMs),
    notes: ['identity-handshake-added-to-load-but-excluded-from-request-timing', 'remote-media-blocked', 'single-desktop-browser',
      'synthetic-36-product-catalog', 'manual-payment-only', 'not-vercel-neon-resources'],
    invariantsChecked: true, fullPageCertified: false, externalProviders: false, productionReady: false }));
  expect(errors).toHaveLength(0); expect(failures).toBe(0); expect(flowMs).toHaveLength(durationMs / 60_000 * checkoutsPerMinute);
  expect(pageStats.every(p => (p.readiness?.count ?? 0) >= 3)).toBe(true);
  await browser.close(); browsers = browsers.filter(b => b !== browser);
}

// Do not inject a four-minute production-only profile into legacy load/dev runs.
describe.skipIf(process.env.TEST_CAPACITY_RUN !== 'true')('WF-19: bounded capacity pilot with user-supplied estimates', () => {
  it('30 HTTP users and two manual checkouts per minute; real browser readiness', async () => {
    await runProfile(30, 2, 1000);
  }, 210_000);
  it('80 HTTP users and five manual checkouts per minute; real browser readiness', async () => {
    await runProfile(80, 5, 1500);
  }, 210_000);
});
