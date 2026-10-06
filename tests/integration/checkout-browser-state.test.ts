import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { addToCart } from '@/services/cart.service';
import { transitionOrder } from '@/lib/commerce/order-command';
import { manualRefund } from '@/services/payment/manual-refund.service';
import { isolatedBrowser } from '../../scripts/lib/isolated-browser.mjs';
import { FreightOrchestratorService } from '@/services/freight/orchestrator.service';
import { CustomTableProvider } from '@/services/freight/providers/custom-table.provider';
import { freightClientResponseSchema } from '@/lib/commerce/freight-contract';
import { POST as quoteRoute } from '@/app/api/freight/calculate/route';
import { freightOrchestrator } from '@/services/freight';
import { getLojaFromHeaders } from '@/lib/tenant';
import { getCurrentUser } from '@/lib/session';
import { sanitizeUser } from '@/lib/utils/dto-sanitizer';
// Only the in-process freight boundary uses injected identity/geography.
// The isolated Next server keeps real session/tenant/cart/checkout handlers.
vi.mock('@/lib/tenant', () => ({ getLojaFromHeaders: vi.fn() }));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/services/freight', () => ({ freightOrchestrator: { calculate: vi.fn() } }));

let browser: Awaited<ReturnType<typeof isolatedBrowser>>;
let lojaID: string, userID: string, adminID: string, productID: string, variantID: string, email: string;
let unavailable = false;
let cartUnavailable = false;
let freightAvailable = false;
const cepRequests: string[] = [];
const freightRequests: Record<string, unknown>[] = [];
let releaseA: () => void, releaseB: () => void;
const a = new Promise<void>(resolve => { releaseA = resolve; });
const b = new Promise<void>(resolve => { releaseB = resolve; });
beforeAll(async () => {
  await verifyTestDatabase(); lojaID = await createFixtureStore();
  adminID = (await prisma.user.create({ data: { lojaID, name: 'Admin', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } })).id;
  email = randomUUID() + '@example.invalid';
  userID = (await prisma.user.create({ data: { lojaID, name: 'Cliente', email, password: '' } })).id;
  const product = await prisma.product.create({ data: { lojaID, userID: adminID, name: 'Produto navegador WF15', description: '', imageUrl: '', price: 100, stock: 30,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 30 } } }, include: { productVariants: true } });
  productID = product.id; variantID = product.productVariants[0].id;
  await addToCart(userID, { productID, variantID, quantity: 1, commandId: randomUUID() }, lojaID);
  const session = await prisma.session.create({ data: { userId: userID, expiresAt: new Date(Date.now() + 3600000) } });
  const loja = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } });
  await prisma.freightRule.create({ data: { lojaID, cityName: 'Cidade B', state: 'SP', municipalityCode: '3550308', value: 15 } });
  const freight = new FreightOrchestratorService([new CustomTableProvider()], async cep => ({ cep, city: 'Cidade B', state: 'SP', municipalityCode: '3550308' }));
  vi.mocked(getLojaFromHeaders).mockResolvedValue(loja);
  vi.mocked(getCurrentUser).mockResolvedValue(sanitizeUser(await prisma.user.findUniqueOrThrow({ where: { id: userID } })));
  vi.mocked(freightOrchestrator.calculate).mockImplementation(async input => {
    if (!freightAvailable) throw new Error('FREIGHT_OPTIONS_UNAVAILABLE');
    return freight.calculate(input);
  });
  browser = await isolatedBrowser({ host: loja.slug + '.plataforma.com', intercept: async ({ url, body, method }) => {
    if (url === '/api/cart' && method === 'GET' && cartUnavailable) return { status: 503, body: { error: 'Fixture cart temporarily unavailable' } };
    if (url.startsWith('/api/checkout/intents/') && unavailable) return { status: 503, body: { error: 'Fixture temporarily unavailable' } };
    if (url.startsWith('/__wf15/cep/')) {
      const cep = url.split('/').at(-1)!; cepRequests.push(cep);
      await (cep === '01001000' ? a : b);
      return { body: { cep, uf: 'SP', localidade: cep === '01001000' ? 'Cidade A' : 'Cidade B', logradouro: cep === '01001000' ? 'Rua A' : 'Rua B', bairro: 'Centro' } };
    }
    if (url === '/api/freight/calculate') {
      const payload = JSON.parse(body); freightRequests.push(payload);
      const response = await quoteRoute(new Request('http://localhost/api/freight/calculate', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body }));
      const envelope = await response.json();
      return { status: response.status, body: response.ok ? freightClientResponseSchema.parse(envelope) : envelope };
    }
    return null;
  } });
  await browser.send('Network.setCookie', { name: 'session_id', value: session.id, url: browser.origin, httpOnly: true });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: String.raw`
    Storage.prototype.setItem = function(){ throw new Error('Storage unavailable in fixture'); };
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const match = typeof input === 'string' && input.match(/^https:\/\/viacep.com.br\/ws\/(\d+)\/json\/?$/);
      // Deliberately ignore abort for the external CEP port: revision must fence it.
      return match ? originalFetch('/__wf15/cep/' + match[1]) : originalFetch(input, init);
    };
  ` });
}, 120000);
afterAll(async () => { releaseA(); releaseB(); if (browser) await browser.close(); await cleanupFixtureStores(); await prisma.$disconnect(); }, 30000);
const text = (value: string) => 'document.body.innerText.toLocaleLowerCase().includes(' + JSON.stringify(value.toLocaleLowerCase()) + ')';
async function customer() {
  await browser.waitFor('!!document.querySelector(\'input[name="name"]\') && !document.querySelector("fieldset").disabled');
  await browser.input('name', 'Cliente preenchido'); await browser.input('email', email);
  await browser.input('phone', '11999999999'); await browser.input('cpfCnpj', '52998224725');
  await browser.click('Avançar para Entrega');
}
describe('WF-15: real Next/React browser, persisted source, financial recovery and delayed transport', () => {
  it('keeps the draft on refresh, buys without storage, preserves a new cart and observes refund after PAID', async () => {
    await browser.navigate('/checkout'); await customer();
    await browser.click('Retornar para a etapa anterior');
    await browser.evaluate('window.dispatchEvent(new Event("focus"))');
    await browser.waitFor('!!document.querySelector(\'input[name="name"]\') && !document.querySelector("fieldset").disabled');
    expect(await browser.evaluate('document.querySelector(\'input[name="name"]\').value')).toBe('Cliente preenchido');
    cartUnavailable = true; await browser.evaluate('window.dispatchEvent(new Event("focus"))');
    await browser.waitFor(text('Não foi possível carregar o carrinho. Tente novamente.'));
    expect(await browser.evaluate('document.querySelector(\'input[name="name"]\').value')).toBe('Cliente preenchido');
    expect(await browser.evaluate('document.querySelector("fieldset").disabled')).toBe(true);
    cartUnavailable = false; await browser.click('Tentar atualizar o carrinho');
    await browser.waitFor('!!document.querySelector("fieldset") && !document.querySelector("fieldset").disabled');
    await browser.click('Avançar para Entrega'); await browser.click('Retirar na Loja'); await browser.click('Avançar para Pagamento');
    await browser.waitFor('!![...document.querySelectorAll("button")].find(e=>e.textContent.includes("Revisar proposta")&&!e.disabled)');
    await browser.click('Revisar proposta de compra'); await browser.waitFor(text('Revise a proposta antes de confirmar'), 45000);
    await browser.click('Confirmar proposta e concluir compra');
    await browser.waitFor('location.pathname === "/checkout/confirmation" && ' + text('Aguardando pagamento'), 45000);
    expect(await browser.evaluate(text('PIX com conferência manual'))).toBe(true);
    expect(await browser.evaluate(text('PIX Dinâmico'))).toBe(false);
    const intentID = await browser.evaluate('new URL(location.href).searchParams.get("intent")') as string;
    const order = await prisma.order.findFirstOrThrow({ where: { checkoutIntentID: intentID, lojaID } });
    expect(order.status).toBe('PENDING'); expect((await prisma.cart.findUniqueOrThrow({ where: { id: order.sourceCartID! } })).status).toBe('COMPLETED');
    const newCart = await addToCart(userID, { productID, variantID, quantity: 2, commandId: randomUUID() }, lojaID);
    await browser.navigate('/checkout/confirmation?intent=' + encodeURIComponent(intentID)); await browser.waitFor(text('Aguardando pagamento'));
    const active = await prisma.cart.findUniqueOrThrow({ where: { id: newCart.id }, include: { items: true } });
    expect(active.status).toBe('ACTIVE'); expect(active.items[0].quantity).toBe(2);
    expect(await transitionOrder({ lojaID, orderId: order.id, newStatus: 'PAID', performedById: adminID })).toMatchObject({ success: true });
    await browser.evaluate('window.dispatchEvent(new Event("focus"))'); await browser.waitFor(text('Pagamento confirmado'));
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    await manualRefund({ lojaID, orderId: order.id, userId: adminID, commandId: randomUUID(), expectedVersion: paid.version, action: 'REQUEST_REFUND' });
    await browser.evaluate('window.dispatchEvent(new Event("focus"))'); await browser.waitFor(text('Estorno em andamento'));
    unavailable = true; await browser.evaluate('window.dispatchEvent(new Event("focus"))'); await browser.waitFor(text('As ações de pagamento estão suspensas'));
    expect(await browser.evaluate('[...document.querySelectorAll("button")].some(e=>e.textContent.toLowerCase().includes("copiar"))')).toBe(false);
    unavailable = false;
    const pending = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    await manualRefund({ lojaID, orderId: order.id, userId: adminID, commandId: randomUUID(), expectedVersion: pending.version,
      action: 'CONFIRM_REFUND', bankReference: 'fixture-bank-reference' });
    await browser.evaluate('window.dispatchEvent(new Event("focus"))'); await browser.waitFor(text('Estorno confirmado'));
    expect(await prisma.order.count({ where: { checkoutIntentID: intentID } })).toBe(1);
    expect((await prisma.cart.findUniqueOrThrow({ where: { id: newCart.id }, include: { items: true } })).items[0].quantity).toBe(2);
  }, 180000);
  it('ignores late CEP A, preserves manual fields during B and exposes freight failure without free fallback', async () => {
    await browser.navigate('/checkout'); await customer();
    await browser.input('address.cep', '01001000');
    await expect.poll(() => cepRequests.includes('01001000')).toBe(true);
    await browser.input('address.cep', '02002000');
    await expect.poll(() => cepRequests.includes('02002000')).toBe(true);
    await browser.input('address.street', 'Rua editada manualmente'); releaseB();
    await browser.waitFor('document.querySelector(\'input[name="address.city"]\')?.value === "Cidade B"');
    releaseA(); await browser.waitFor(text('Não foi possível autorizar esta cotação de frete.'));
    expect(await browser.evaluate('document.querySelector(\'input[name="address.street"]\').value')).toBe('Rua editada manualmente');
    expect(await browser.evaluate('document.querySelector(\'input[name="address.city"]\').value')).toBe('Cidade B');
    expect(freightRequests.length).toBeGreaterThan(0);
    expect(freightRequests.at(-1)).toMatchObject({ destinationCep: '02002000', items: [{ productId: productID, variantId: variantID, quantity: 2 }] });
    expect(JSON.stringify(freightRequests.at(-1))).not.toContain('price');
    await browser.input('address.number', '1');
    await browser.waitFor('!![...document.querySelectorAll("button")].find(e=>e.textContent.includes("Avançar para Pagamento")&&!e.disabled)');
    await browser.click('Avançar para Pagamento');
    await browser.waitFor(text('Por favor, selecione uma modalidade de frete.'));
    expect(await browser.evaluate(text('Etapa 02/03'))).toBe(true);
  }, 120000);
  it('selects a real persisted signed freight quote and completes DELIVERY through the canonical HTTP checkout', async () => {
    freightAvailable = true;
    await browser.navigate('/checkout'); await customer(); await browser.input('address.cep', '02002000');
    await browser.waitFor('!![...document.querySelectorAll("button")].find(e=>e.textContent.includes("Entrega Local (Cidade B)"))');
    await browser.input('address.number', '42');
    await browser.waitFor('!![...document.querySelectorAll("button")].find(e=>e.textContent.includes("Entrega Local (Cidade B)"))');
    await browser.click('Entrega Local (Cidade B)'); await browser.click('Avançar para Pagamento');
    await browser.waitFor('!![...document.querySelectorAll("button")].find(e=>e.textContent.includes("Revisar proposta")&&!e.disabled)');
    await browser.click('Revisar proposta'); await browser.waitFor(text('Revise a proposta antes de confirmar'));
    expect(await browser.evaluate(text('Entrega: Rua B, 42'))).toBe(true);
    await browser.click('Confirmar proposta e concluir compra');
    await browser.waitFor('location.pathname === "/checkout/confirmation" && ' + text('Aguardando pagamento'));
    const intentID = await browser.evaluate('new URL(location.href).searchParams.get("intent")') as string;
    const order = await prisma.order.findFirstOrThrow({ where: { checkoutIntentID: intentID, lojaID }, include: { buyer: true } });
    expect(order.deliveryType).toBe('DELIVERY'); expect(order.shippingCost.toFixed(2)).toBe('15.00'); expect(order.total.toFixed(2)).toBe('215.00');
    expect(order.buyer?.deliveryAddress).toMatchObject({ street: 'Rua B', number: '42', cep: '02002000' });
    expect(await prisma.freightQuote.count({ where: { lojaID, ownerKey: 'u:' + userID } })).toBeGreaterThan(0);
  }, 120000);
  it('reconciles another tab through BroadcastChannel and resets commerce data on identity change', async () => {
    const intentID = await browser.evaluate('new URL(location.href).searchParams.get("intent")') as string;
    const pending = await prisma.order.findFirstOrThrow({ where: { lojaID, checkoutIntentID: intentID } });
    expect(await transitionOrder({ lojaID, orderId: pending.id, newStatus: 'CANCELLED', performedById: adminID,
      expectedVersion: pending.version })).toMatchObject({ success: true });
    await browser.evaluate('window.dispatchEvent(new Event("focus"))'); await browser.waitFor(text('Compra cancelada'));
    expect(await browser.evaluate('[...document.querySelectorAll("button")].some(e=>e.textContent.toLowerCase().includes("copiar"))')).toBe(false);
    await browser.navigate('/checkout/confirmation?intent=' + encodeURIComponent(intentID)); await browser.waitFor(text('Compra cancelada'));
    const cart = await addToCart(userID, { productID, variantID, quantity: 1, commandId: randomUUID() }, lojaID);
    const target = await browser.send('Target.createTarget', { url: 'about:blank' }) as { targetId: string };
    const attached = await browser.send('Target.attachToTarget', { targetId: target.targetId, flatten: true }) as { sessionId: string };
    const evaluate = async (expression: string) => {
      const response = await browser.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, attached.sessionId) as { result: { value: unknown } };
      return response.result.value;
    };
    try {
      await browser.send('Page.navigate', { url: browser.origin + '/checkout' }, attached.sessionId);
      await expect.poll(() => evaluate(text('Qtd: 1')), { timeout: 30000 }).toBe(true);
      const response = await browser.evaluate('fetch("/api/cart",{method:"PATCH",headers:{"Content-Type":"application/json"},body:' + JSON.stringify(JSON.stringify({
        variantID, quantity: 2, commandId: randomUUID(), cartId: cart.id, expectedVersion: cart.version,
      })) + '}).then(async r=>{if(!r.ok)throw Error("fixture mutation failed"); window.dispatchEvent(new Event("commerce-cart-changed"));return r.status})');
      expect(response).toBe(200);
      await expect.poll(() => evaluate(text('Qtd: 2')), { timeout: 30000 }).toBe(true);
      const peer = await prisma.user.create({ data: { lojaID, name: 'Outro cliente', email: randomUUID() + '@example.invalid', password: '' } });
      const session = await prisma.session.create({ data: { userId: peer.id, expiresAt: new Date(Date.now() + 3600000) } });
      await browser.send('Network.setCookie', { name: 'session_id', value: session.id, url: browser.origin, httpOnly: true });
      await browser.navigate('/checkout'); await browser.waitFor(text('Seu Carrinho está Vazio'));
      expect(await browser.evaluate(text('Produto navegador WF15'))).toBe(false);
      expect((await prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: { items: true } })).items[0].quantity).toBe(2);
    } finally { await browser.send('Target.closeTarget', { targetId: target.targetId }); }
  }, 120000);
});
