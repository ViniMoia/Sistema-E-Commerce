import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { chargebackFixture } from '@/tests/setup/chargeback-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';
let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
beforeAll(verifyTestDatabase);
afterAll(async () => { if (browser) await browser.close(); vi.unstubAllEnvs(); await cleanupFixtureStores(); await prisma.$disconnect(); }, 30000);
it('Admin shows dispute and verified reversal after reload without a financial action button', async () => {
  vi.stubEnv('INSTALLMENT_MONTHLY_RATE','0'); vi.stubEnv('INSTALLMENT_ABSORB_FEES','false');
  const p = await chargebackFixture();
  p.remote[0].chargeback = { status: 'IN_DISPUTE', reason: 'COMMERCIAL_DISAGREEMENT' }; await p.observe();
  const order = await p.read();
  browser = await isolatedBrowser({ host: p.host });
  await browser.send('Network.setCookie', { name: 'session_id', value: p.session.id, url: browser.origin, httpOnly: true });
  async function open() {
    await browser.navigate('/admin/orders');
    const row = '[...document.querySelectorAll("tbody tr")].find(e=>e.textContent.includes(' + JSON.stringify('#' + order.orderNumber) + '))';
    await browser.waitFor('!!' + row, 45000); await browser.evaluate(row + '.click()');
  }
  await open();
  await browser.waitFor('document.body.innerText.includes("Contestação em andamento")', 45000);
  expect(await browser.evaluate('document.querySelector(\'section[aria-label="Chargeback"]\').querySelectorAll("button").length')).toBe(0);
  p.remote[0].chargeback = { status: 'REVERSED' }; await p.observe();
  await open(); await browser.waitFor('document.body.innerText.includes("Contestação revertida; pagamento confirmado")', 45000);
  expect((await p.stock()).stock).toBe(4);
}, 180000);
