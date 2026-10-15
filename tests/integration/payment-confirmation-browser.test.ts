import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { purchaseClientSchema, type PurchaseClient } from '@/lib/commerce/purchase-client';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';

// UI contract tests: an isolated Next/browser receives controlled DTO snapshots.
// No payment is issued and no remote order, provider or queue is accessed.
let host: string;
const browsers: Awaited<ReturnType<typeof isolatedBrowser>>[] = [];
beforeAll(async () => {
  await verifyTestDatabase();
  const lojaID = await createFixtureStore();
  host = (await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug + '.plataforma.com';
});
afterEach(async () => { for (const browser of browsers.splice(0)) await browser.close(); }, 60000);
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });

async function fixture(mobile = false) {
  const order = purchaseClientSchema.parse({ id: randomUUID(), checkoutIntentID: randomUUID(), orderNumber: 9001,
    status: 'PENDING', version: 0, paymentState: 'ISSUED', financialState: 'PENDING', paymentMethod: 'BOLETO',
    allowedActions: ['PAY_BOLETO'], serverTime: '2030-10-15T12:00:00Z', paymentExpiresAt: '2030-10-16T03:00:00Z',
    asaasDueDate: '2030-10-16T03:00:00Z', asaasBankSlipUrl: 'https://example.invalid/fixture-boleto',
    asaasDigitableLine: 'fixture-digitable-line', customer: { name: 'Cliente sintético', phone: '' },
    items: [{ name: 'Produto sintético', quantity: 1, price: 49.9 }], deliveryType: 'PICKUP',
    total: 49.9, financialTotal: 49.9, freightValue: 0 });
  const requests: { method: string; url: string }[] = [];
  let unavailable = false;
  const browser = await isolatedBrowser({ host, intercept: async ({ url, method }) => {
    if (!url.startsWith('/api/checkout')) return null;
    requests.push({ method: method ?? 'GET', url });
    if (unavailable) return { status: 503, body: {} };
    return { body: { data: { result: { order } } } };
  } });
  browsers.push(browser);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1280, height: mobile ? 844 : 900, mobile, deviceScaleFactor: 1 });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__copyFails = false; window.__copies = []; window.__opens = []; window.__unhandled = [];
    addEventListener('unhandledrejection', event => { window.__unhandled.push(String(event.reason)); event.preventDefault(); });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => {
      if (window.__copyFails) throw new Error('Fixture clipboard denied'); window.__copies.push(value);
    } } });
    window.open = (...args) => { window.__opens.push(args); return null; };
  ` });
  await browser.send('Emulation.setTimezoneOverride', { timezoneId: 'Pacific/Kiritimati' });
  const path = '/checkout/confirmation?intent=' + order.checkoutIntentID + '&success=true&status=approved';
  await browser.navigate(path);
  await browser.waitFor(`document.querySelector('h1')?.textContent.includes('Aguardando pagamento')`);
  const refresh = async (update: Partial<PurchaseClient>) => {
    Object.assign(order, update);
    const before = requests.length;
    await browser.evaluate(`dispatchEvent(new Event('focus'))`);
    await expect.poll(() => requests.length).toBeGreaterThan(before);
  };
  return { browser, order, requests, path, refresh, setUnavailable: (value: boolean) => { unavailable = value; } };
}
const has = (text: string) => `document.body.innerText.toLocaleLowerCase().includes(${JSON.stringify(text.toLocaleLowerCase())})`;
const copy = `document.querySelector('svg.lucide-copy')?.closest('button')`;

describe('V-02: confirmação de boleto e retorno não autoritativo', () => {
  it('não anuncia cópia quando o navegador recusa e permite tentar novamente', async () => {
    const { browser } = await fixture(true);
    await browser.evaluate(`window.__copyFails = true; ${copy}.click()`);
    await browser.waitFor(has('Não foi possível copiar'));
    expect(await browser.evaluate('window.__copies')).toEqual([]);
    expect(await browser.evaluate('window.__unhandled')).toEqual([]);
    expect(await browser.evaluate(`!!document.querySelector('svg.lucide-check')`)).toBe(false);
    expect(await browser.evaluate(`${copy}.getAttribute('aria-label')`)).toBe('Copiar linha digitável');
    expect(await browser.evaluate(`${copy}.getBoundingClientRect().right <= innerWidth`)).toBe(true);
    await browser.evaluate(`window.__copyFails = false; ${copy}.click()`);
    await browser.waitFor(has('Linha digitável copiada'));
    expect(await browser.evaluate('window.__copies')).toEqual(['fixture-digitable-line']);
    expect(await browser.evaluate(has('Não foi possível copiar'))).toBe(false);
  }, 60000);

  it('preserva o vencimento civil, ignora sucesso no callback e retoma a mesma compra no reload', async () => {
    const { browser, order, requests, path } = await fixture();
    expect(await browser.evaluate('document.body.innerText')).toContain('Vencimento: 15/10/2030');
    expect(await browser.evaluate(has('Pagamento confirmado'))).toBe(false);
    await browser.click('Visualizar / Imprimir');
    expect(await browser.evaluate('window.__opens')).toEqual([[order.asaasBankSlipUrl, '_blank', 'noopener,noreferrer']]);
    await browser.navigate(path);
    await browser.waitFor(has('Vencimento: 15/10/2030'));
    expect(requests.every(request => request.method === 'GET' && request.url.endsWith(order.checkoutIntentID))).toBe(true);
  }, 60000);

  it('suspende instruções em falha de consulta e recupera sem emitir outra compra', async () => {
    const { browser, refresh, setUnavailable, requests } = await fixture();
    setUnavailable(true); await refresh({});
    await browser.waitFor(has('As ações de pagamento estão suspensas'));
    expect(await browser.evaluate(has('Visualizar / Imprimir'))).toBe(false);
    setUnavailable(false); await refresh({});
    await browser.waitFor(has('Visualizar / Imprimir'));
    expect(requests.every(request => request.method === 'GET')).toBe(true);
  }, 60000);

  it('retira instruções vencidas e apresenta cancelamento/estorno sem anunciar pagamento', async () => {
    const { browser, refresh } = await fixture();
    await refresh({ serverTime: '2030-10-16T03:00:00Z' });
    await browser.waitFor(has('Prazo de pagamento encerrado'));
    expect(await browser.evaluate(has('Visualizar / Imprimir'))).toBe(false);
    for (const [financialState, title] of [
      ['CANCEL_PENDING', 'Cancelamento em andamento'], ['CANCELLED', 'Compra cancelada'],
      ['REFUND_PENDING', 'Estorno em andamento'], ['REFUNDED', 'Estorno confirmado'],
    ] as const) {
      await refresh({ financialState, paymentState: financialState === 'CANCELLED' ? 'CANCELLED' : 'PROCESSING',
        status: financialState === 'CANCELLED' || financialState === 'REFUNDED' ? 'CANCELLED' : 'PENDING' });
      await browser.waitFor(`document.querySelector('h1')?.textContent.includes(${JSON.stringify(title)})`);
      expect(await browser.evaluate(has('Visualizar / Imprimir'))).toBe(false);
      expect(await browser.evaluate(has('Aprovado / Pago'))).toBe(false);
    }
  }, 60000);

  it('trata clipboard ausente no PIX e ignora resposta de cópia após cancelamento', async () => {
    const { browser, refresh } = await fixture(true);
    await refresh({ paymentMethod: 'PIX', allowedActions: ['PAY_PIX'], pixPayload: 'fixture-pix',
      pixQrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOJkAAAAASUVORK5CYII=' });
    await browser.waitFor(`!!document.querySelector('button[aria-label="Copiar código PIX"]')`);
    await browser.evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}); ${copy}.click()`);
    await browser.waitFor(has('Não foi possível copiar'));
    await browser.evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise(resolve=>{window.__releaseCopy=resolve})}}); ${copy}.click()`);
    await browser.waitFor(has('Copiando...'));
    await refresh({ status: 'CANCELLED', paymentState: 'CANCELLED', financialState: 'CANCELLED' });
    await browser.waitFor(has('Compra cancelada'));
    await browser.evaluate(`window.__releaseCopy(); new Promise(resolve=>setTimeout(resolve,100))`);
    expect(await browser.evaluate(has('Código PIX copiado'))).toBe(false);
    expect(await browser.evaluate('window.__unhandled')).toEqual([]);
  }, 60000);
});
