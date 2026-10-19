import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { refundedPhysicalOrder } from '@/tests/setup/physical-return-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';
let f: Awaited<ReturnType<typeof createFulfillmentFixture>>;
let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let posts = 0;
beforeAll(async () => {
  await verifyTestDatabase(); f = await createFulfillmentFixture();
  browser = await isolatedBrowser({ host: f.host, intercept: async ({ url, method }) => {
    if (url.endsWith('/physical-return') && method === 'POST') posts++;
    return null;
  } });
  await browser.send('Network.setCookie', { name: 'session_id', value: f.session.id, url: browser.origin, httpOnly: true });
}, 120000);
afterAll(async () => { if (browser) await browser.close(); await cleanupFixtureStores(); await prisma.$disconnect(); }, 30000);

describe('physical return in actual Admin drawer', () => {
  it('requires inspection, keeps damaged units unavailable and reloads a durable receipt without another POST', async () => {
    const o = await refundedPhysicalOrder(f);
    async function open() {
      await browser.navigate('/admin/orders');
      const row = '[...document.querySelectorAll("tbody tr")].find(e=>e.textContent.includes(' + JSON.stringify('#' + o.orderNumber) + '))';
      await browser.waitFor('!!' + row, 45000); await browser.evaluate(row + '.click()');
    }
    await open();
    await browser.waitFor('!!document.querySelector(\'input[name="physicalReturnReceived"]\')', 45000);
    expect(await browser.evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent.includes("Registrar retorno físico")).disabled')).toBe(true);
    await browser.input('physicalReturnReference', 'inspection-fixture-damaged');
    await browser.evaluate('document.querySelector(\'input[name="physicalReturnReceived"]\').click()');
    await browser.click('Registrar retorno físico');
    await browser.waitFor('document.body.innerText.includes("Retorno físico registrado")', 45000);
    expect(posts).toBe(1);
    expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: o.reservations[0].variantId } })).toMatchObject({ stock: 1, unavailableStock: 1 });
    await open();
    await browser.waitFor('document.body.innerText.includes("Retorno físico registrado")', 45000);
    expect(await browser.evaluate('document.body.innerText.includes("0 disponível(is) para venda, 1 indisponível(is)")')).toBe(true);
    expect(await browser.evaluate('!!document.querySelector(\'input[name="physicalReturnReceived"]\')')).toBe(false);
    expect(posts).toBe(1);
  }, 180000);
});
