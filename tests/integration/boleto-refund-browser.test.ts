import { beforeAll, afterAll, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { boletoRefundFixture } from '@/tests/setup/boleto-refund-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';
let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
beforeAll(verifyTestDatabase);
afterAll(async () => { if (browser) await browser.close(); await cleanupFixtureStores(); await prisma.$disconnect(); }, 30000);

it('mobile Admin confirms one request, reloads its private link and removes it after completion', async () => {
  const p = await boletoRefundFixture(); const order = await p.read(); let posts = 0;
  browser = await isolatedBrowser({ host: p.host, intercept: async ({ url, method }) => {
    if (url.endsWith('/payment-operation') && method === 'POST') posts++;
    return null;
  } });
  await browser.send('Network.setCookie', { name: 'session_id', value: p.session.id, url: browser.origin, httpOnly: true });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  async function open() {
    await browser.navigate('/admin/orders');
    const row = 'document.querySelector(\'tr[data-order-id="' + order.id + '"]\')';
    await browser.waitFor('!!' + row, 45000);
    await browser.evaluate(row + '.click()');
    await browser.waitFor('!!document.querySelector(\'section[aria-label="Devolução de boleto"]\')', 45000);
  }
  const section = 'document.querySelector(\'section[aria-label="Devolução de boleto"]\')';
  await open(); await browser.waitFor('!!' + section + '.querySelector("input")', 45000);
  expect(await browser.evaluate(section + '.querySelector("button[type=submit]").disabled')).toBe(true);
  await browser.evaluate(section + '.querySelector("input").click()');
  await browser.click('Solicitar devolução do boleto');
  await browser.waitFor('document.body.innerText.includes("Solicitação registrada")', 45000);
  expect(posts).toBe(1); expect(p.gateway.refundBoleto).not.toHaveBeenCalled();
  await p.tick(); await browser.click('Atualizar consulta da devolução');
  await browser.waitFor('document.body.innerText.includes("O dinheiro ainda não foi devolvido")', 45000);
  expect(await browser.evaluate(section + '.querySelector("a").getAttribute("href")')).toBe(p.requestUrl);
  expect(await browser.evaluate(section + '.querySelector("a").getAttribute("rel")')).toContain('noreferrer');
  expect(await browser.evaluate(section + '.scrollWidth <= ' + section + '.clientWidth')).toBe(true);
  await open(); await browser.waitFor('!!' + section + '.querySelector("a")', 45000);
  expect(posts).toBe(1);
  p.remote[0].refundHistory = { complete: true, records: [{ status: 'DONE', value: 100 }] };
  p.remote[0].status = 'REFUNDED'; await p.tick(); await browser.click('Atualizar consulta da devolução');
  await browser.waitFor('document.body.innerText.includes("Devolução integral confirmada")', 45000);
  expect(await browser.evaluate(section + '.querySelectorAll("a, input, button[type=submit]").length')).toBe(0);
  expect(posts).toBe(1);
}, 180000);
