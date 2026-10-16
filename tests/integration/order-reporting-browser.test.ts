import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

let f: Awaited<ReturnType<typeof createFulfillmentFixture>>;
let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let commercialNumbers: number[], testNumber: number, foreignId: string;
const rowNumbers = '[...document.querySelectorAll("tbody tr td:first-child > span:first-child")].map(e=>Number(e.textContent.trim().slice(1)))';
const bodyHas = (text: string) => 'document.body.innerText.toLocaleLowerCase().includes(' + JSON.stringify(text.toLocaleLowerCase()) + ')';
const countIs = (n: number) => rowNumbers + '.length===' + n;
const scopeButton = (label: string) => '[...document.querySelectorAll(\'[aria-label="Origem dos pedidos"] button\')].find(e=>e.textContent.trim()===' + JSON.stringify(label) + ')';

beforeAll(async () => {
  await verifyTestDatabase(); f = await createFulfillmentFixture();
  const ids = Array.from({ length: 101 }, () => randomUUID());
  await prisma.order.createMany({ data: ids.map(id => ({ id, lojaID: f.lojaID, userID: f.customer.id, subtotal: 1, total: 1, deliveryType: 'PICKUP' })) });
  commercialNumbers = (await prisma.order.findMany({ where: { id: { in: ids } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { orderNumber: true } })).map(o => o.orderNumber);
  const excluded = await prisma.order.create({ data: { lojaID: f.lojaID, userID: f.customer.id, status: 'CANCELLED', subtotal: 10, total: 10, deliveryType: 'PICKUP',
    reportingExclusion: { create: { reason: 'USER_CLASSIFIED_TEST_DATA', classificationBatch: 'fixture-reporting', classifiedBy: 'fixture' } } } });
  testNumber = excluded.orderNumber;
  await prisma.order.create({ data: { lojaID: f.lojaID, userID: f.customer.id, status: 'PAID', subtotal: 20, total: 20, deliveryType: 'PICKUP',
    reportingExclusion: { create: { reason: 'USER_CLASSIFIED_TEST_DATA', classificationBatch: 'fixture-reporting', classifiedBy: 'fixture' } } } });
  const other = await createFulfillmentFixture();
  foreignId = (await other.order('PICKUP')).id;
  browser = await isolatedBrowser({ host: f.host });
  await browser.send('Network.setCookie', { name: 'session_id', value: f.session.id, url: browser.origin, httpOnly: true });
}, 120000);
afterAll(async () => { if (browser) await browser.close(); await cleanupFixtureStores(); await prisma.$disconnect(); }, 30000);

describe('explicit reporting scope in real Admin and authenticated API', () => {
  it('defaults to commercial, searches beyond the first page, paginates, filters history and preserves tenant boundaries', async () => {
    await browser.navigate('/admin/orders');
    await browser.waitFor(countIs(100), 60000);
    expect(await browser.evaluate(scopeButton('Comerciais') + '.getAttribute("aria-pressed")')).toBe('true');
    expect(await browser.evaluate(rowNumbers)).toEqual(commercialNumbers.slice(0, 100));
    // Searching must reach a record outside the first page, without loading it first.
    await browser.input('orderSearch', String(commercialNumbers[100]));
    await browser.waitFor(countIs(1) + ' && ' + rowNumbers + '[0]===' + commercialNumbers[100]);
    await browser.input('orderSearch', ''); await browser.waitFor(countIs(100));
    await browser.click('Carregar mais pedidos'); await browser.waitFor(countIs(101));
    expect(await browser.evaluate(rowNumbers)).toEqual(commercialNumbers);
    await browser.click('Histórico de testes'); await browser.waitFor(countIs(2));
    expect(await browser.evaluate(bodyHas('Teste · fora dos indicadores'))).toBe(true);
    expect(await browser.evaluate(rowNumbers)).toContain(testNumber);
    await browser.click('Cancelados'); await browser.waitFor(countIs(1) + ' && ' + rowNumbers + '[0]===' + testNumber);
    await browser.evaluate('document.querySelector("tbody tr").click()');
    await browser.waitFor(bodyHas('Pedido de teste'), 45000);
    await browser.navigate('/admin/orders'); await browser.waitFor(countIs(100));
    await browser.evaluate(scopeButton('Todos') + '.click()'); await browser.waitFor(countIs(100));
    await browser.waitFor(bodyHas('Teste · fora dos indicadores'));
    await browser.click('Carregar mais pedidos'); await browser.waitFor(countIs(103));
    const result = await browser.evaluate('(async()=>{const paths=' + JSON.stringify([
      '/api/admin/orders?reportingScope=INVALID', '/api/admin/orders?reportingScope=TEST&search=999999999999999999999999999',
      '/api/admin/orders/' + foreignId,
    ]) + ';return Promise.all(paths.map(async p=>{const r=await fetch(p);return {status:r.status,body:await r.json()}}))})()');
    expect(result[0].status).toBe(400);
    expect(result[1].status).toBe(200); expect(result[1].body.data.totalCount).toBe(0);
    expect(result[2].status).toBe(404);
    expect(await prisma.order.count({ where: { lojaID: f.lojaID } })).toBe(103);
    expect(await prisma.orderReportingExclusion.count({ where: { order: { lojaID: f.lojaID } } })).toBe(2);
  }, 180000);
});
