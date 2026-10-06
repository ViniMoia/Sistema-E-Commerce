import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { FreightOrchestratorService, freightQuoteBinding } from '@/services/freight/orchestrator.service';
import { CustomTableProvider } from '@/services/freight/providers/custom-table.provider';
import { JtExpressProvider } from '@/services/freight/providers/jt-express.provider';
import { PickupProvider } from '@/services/freight/providers/pickup.provider';
import { acceptFreightQuote } from '@/lib/freight/acceptance';
import { signFreightQuote } from '@/lib/freight-quote';
import { createFreightRule, updateFreightRule, deleteFreightRule } from '@/services/freight.service';
import { createOrder } from '@/tests/setup/checkout-fixture';
import { createOrderFromCart } from '@/tests/setup/checkout-fixture';
import { addToCart } from '@/services/cart.service';
import { post, get } from '@/tests/helpers/request';
import type { IFreightProvider, FreightOption } from '@/types/freight';

const geo = async (cep: string) => ({ cep, state: 'SP', city: 'São Paulo', municipalityCode: '3550308' });
const address = { cep: '01001000', state: 'SP', city: 'São Paulo', neighborhood: 'Centro', street: 'Rua', number: '1' };
beforeAll(async () => { await verifyTestDatabase(); });
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
async function fixture(withRule = true) {
  const lojaID = await createFixtureStore();
  const user = await prisma.user.create({ data: { lojaID, name: 'Admin', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } });
  const product = await prisma.product.create({ data: { lojaID, userID: user.id, name: 'Mercadoria', description: '', imageUrl: '', price: 100, stock: 20,
    weightInGrams: 300, lengthCm: 16, widthCm: 11, heightCm: 4,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 20 } } }, include: { productVariants: true } });
  const items = [{ productId: product.id, variantId: product.productVariants[0].id, quantity: 1 }];
  const ownerKey = 'u:' + user.id;
  const rule = withRule ? await createFreightRule({ lojaID, actorId: user.id, cityName: 'São Paulo', state: 'SP', municipalityCode: '3550308', value: 15 }) : null;
  const engine = new FreightOrchestratorService([new CustomTableProvider()], geo);
  const params = { lojaID, ownerKey, items, destinationCep: '01001000', deliveryType: 'DELIVERY' as const };
  const quote = () => engine.calculate(params);
  const accept = (token: string, overrides = {}) => prisma.$transaction(tx => acceptFreightQuote(tx, { ...params, token, address, ...overrides }));
  const purchase = (token?: string, overrides = {}) => createOrder({ lojaID, items: items.map(item => ({ ...item, name: 'Cliente falso', price: 1 })),
    customer: { userId: user.id, email: user.email, name: user.name, phone: '11999999999', cpfCnpj: '52998224725' },
    deliveryType: 'DELIVERY', address, paymentMethod: 'WHATSAPP_PIX', freightQuoteToken: token, ...overrides });
  return { lojaID, user, product, items, ownerKey, rule, engine, params, quote, accept, purchase };
}
async function effects(f: Awaited<ReturnType<typeof fixture>>) {
  return { stock: (await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock,
    orders: await prisma.order.count({ where: { lojaID: f.lojaID } }), buyers: await prisma.orderBuyer.count({ where: { lojaID: f.lojaID } }) };
}
const option = (price = 15): FreightOption => ({ providerId: 'LOCAL_TABLE', serviceCode: 'LOCAL_TEST', serviceName: 'Local', price, deliveryTimeInDays: 1 });
function provider(calculateQuotes: IFreightProvider['calculateQuotes']): IFreightProvider {
  return { id: 'LOCAL_TABLE', name: 'Local', isAvailableForStore: async () => true, calculateQuotes };
}

describe('WF-11 / LA-031, LA-008: persisted freight authority', () => {
  it('catalog prices and dimensions override input; accepted snapshot defeats forged free shipping', async () => {
    const f = await fixture();
    const result = await f.engine.calculate({ ...f.params, items: [{ ...f.items[0], price: 1, weightInGrams: 1 } as typeof f.items[0]] });
    expect(result.merchandiseSubtotal).toBe('100.00'); expect(result.packageDetails.weightInGrams).toBe(300);
    const created = await f.purchase(result.options[0].freightQuoteToken!, { shippingCost: 0, freightValue: 0, shippingProvider: 'NONE' });
    expect(created.order).toMatchObject({ subtotal: 100, shippingCost: 15, total: 115, shippingProvider: 'LOCAL_TABLE' });
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: created.order.id } });
    expect(stored.freightQuoteId).toBe(result.options[0].freightQuoteId);
    expect(stored.freightSnapshot).toMatchObject({ schemaVersion: 2, amount: '15.00', declaredValue: '100.00', destination: { municipalityCode: '3550308' } });
    await updateFreightRule({ id: f.rule!.id, lojaID: f.lojaID, actorId: f.user.id, value: 25 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: stored.id } })).freightSnapshot).toEqual(stored.freightSnapshot);
  });
  it('missing quote refuses DELIVERY before buyer creation and inventory reservation', async () => {
    const f = await fixture(); const before = await effects(f);
    await expect(f.purchase(undefined, { shippingCost: 0, freightValue: 0 })).rejects.toThrow('FREIGHT_QUOTE_REQUIRED');
    expect(await effects(f)).toEqual(before);
  });
  it('quote binds owner, tenant, service, destination and quantities', async () => {
    const f = await fixture(); const token = (await f.quote()).options[0].freightQuoteToken!;
    for (const change of [{ ownerKey: 'u:' + randomUUID() }, { lojaID: randomUUID() }, { deliveryType: 'PICKUP' },
      { address: { ...address, state: 'MG' } }, { address: { ...address, cep: '01001001' } },
      { items: [{ ...f.items[0], quantity: 2 }] }]) await expect(f.accept(token, change)).rejects.toThrow('FREIGHT_');
    expect(await effects(f)).toEqual({ stock: 20, orders: 0, buyers: 0 });
  });
  it('destination key order cannot change authority when JSONB reconstructs the snapshot', async () => {
    const f = await fixture();
    const engine = new FreightOrchestratorService([new CustomTableProvider()], async cep => ({ municipalityCode: '3550308', city: 'São Paulo', cep, state: 'SP' }));
    const token = (await engine.calculate(f.params)).options[0].freightQuoteToken!;
    expect((await f.accept(token)).amount.toFixed(2)).toBe('15.00');
  });
  it('tampered signed token or persisted amount cannot authorize a purchase', async () => {
    const f = await fixture(); const result = (await f.quote()).options[0]; const token = result.freightQuoteToken!;
    await expect(f.accept(token.slice(0, -4) + 'AAAA')).rejects.toThrow();
    await prisma.freightQuote.update({ where: { id: result.freightQuoteId }, data: { amount: 0 } });
    await expect(f.purchase(token)).rejects.toThrow('FREIGHT_REQUOTE_REQUIRED'); expect(await effects(f)).toEqual({ stock: 20, orders: 0, buyers: 0 });
  });
  it('changed service or variant is rejected and disabled modality revokes an issued quote', async () => {
    const f = await fixture(); const option = (await f.quote()).options[0];
    await expect(f.accept(option.freightQuoteToken!, { items: [{ ...f.items[0], variantId: randomUUID() }] })).rejects.toThrow('FREIGHT_VARIANT_UNAVAILABLE');
    await prisma.freightQuote.update({ where: { id: option.freightQuoteId }, data: { serviceCode: 'ANOTHER_SERVICE' } });
    await expect(f.accept(option.freightQuoteToken!)).rejects.toThrow('FREIGHT_REQUOTE_REQUIRED');
    await prisma.loja.update({ where: { id: f.lojaID }, data: { enablePickup: true } });
    const pickup = (await new FreightOrchestratorService([new PickupProvider()], geo).calculate({ ...f.params, deliveryType: 'PICKUP' })).options[0];
    await prisma.loja.update({ where: { id: f.lojaID }, data: { enablePickup: false } });
    await expect(f.purchase(pickup.freightQuoteToken!, { deliveryType: 'PICKUP' })).rejects.toThrow('FREIGHT_REQUOTE_REQUIRED');
    expect(await effects(f)).toEqual({ stock: 20, orders: 0, buyers: 0 });
  });
  it('item order is canonical; cached calculation emits independent owner-bound tokens with the same deadline', async () => {
    const f = await fixture(); const second = await prisma.product.create({ data: { lojaID: f.lojaID, userID: f.user.id, name: 'Segunda', description: '', imageUrl: '', price: 10, stock: 5,
      productVariants: { create: { size: 'Único', color: 'Padrão', stock: 5 } } }, include: { productVariants: true } });
    const calc = vi.fn(async () => [option()]); const engine = new FreightOrchestratorService([provider(calc)], geo);
    const items = [...f.items, { productId: second.id, variantId: second.productVariants[0].id, quantity: 1 }];
    const a = (await engine.calculate({ ...f.params, items })).options[0];
    const b = (await engine.calculate({ ...f.params, items: [...items].reverse(), ownerKey: 'g:' + 'a'.repeat(64) })).options[0];
    expect(calc).toHaveBeenCalledTimes(1); expect(a.freightQuoteId).not.toBe(b.freightQuoteId); expect(a.expiresAt).toBe(b.expiresAt);
    await expect(f.accept(b.freightQuoteToken!, { items })).rejects.toThrow('FREIGHT_QUOTE_INVALID');
  });
  it('instance B invalidates its cache after instance A changes a local rule', async () => {
    const f = await fixture(); const before = (await f.quote()).options[0];
    await updateFreightRule({ id: f.rule!.id, lojaID: f.lojaID, actorId: f.user.id, value: 25 });
    expect((await f.quote()).options[0].price).toBe(25); await expect(f.accept(before.freightQuoteToken!)).rejects.toThrow('FREIGHT_REQUOTE_REQUIRED');
    const otherInstance = new FreightOrchestratorService([new CustomTableProvider()], geo);
    expect((await otherInstance.calculate(f.params)).options[0].price).toBe(25);
  });
  it('settings, physical dimensions and price changes revoke old authority without relying on TTL', async () => {
    const f = await fixture();
    for (const mutate of [() => prisma.loja.update({ where: { id: f.lojaID }, data: { additionalDays: 2 } }),
      () => prisma.product.update({ where: { id: f.product.id }, data: { lengthCm: 20 } }),
      () => prisma.product.update({ where: { id: f.product.id }, data: { price: 1000 } })]) {
      const token = (await f.quote()).options[0].freightQuoteToken!; await mutate();
      await expect(f.accept(token)).rejects.toThrow('FREIGHT_REQUOTE_REQUIRED');
    }
    expect((await f.quote()).merchandiseSubtotal).toBe('1000.00');
  });
  it('same package with merchandise100 versus1000 gets the actual J&T insurance premium; tariff edit invalidates cache', async () => {
    const f = await fixture(false); await prisma.loja.update({ where: { id: f.lojaID }, data: { originCep: '67140615' } });
    const geocomCode = randomUUID(); const g = await prisma.jtExpressGeocom.create({ data: { geocomCode, state: 'SP', cepStart: '01001000', cepEnd: '01001999' } });
    const rate = await prisma.jtExpressRate.create({ data: { geocom: geocomCode, macroRegion: 'Fixture', weightMin: 0, weightMax: 30, basePrice: 20, additionalKgPrice: 1 } });
    try {
      const engine = new FreightOrchestratorService([new JtExpressProvider()], geo);
      const a = (await engine.calculate(f.params)).options[0]; expect(a.price).toBe(20.6);
      await prisma.product.update({ where: { id: f.product.id }, data: { price: 1000 } });
      const b = (await engine.calculate(f.params)).options[0]; expect(b.price).toBe(26);
      await expect(f.accept(a.freightQuoteToken!)).rejects.toThrow('FREIGHT_REQUOTE_REQUIRED');
      await prisma.jtExpressRate.update({ where: { id: rate.id }, data: { basePrice: 30 } });
      expect((await engine.calculate(f.params)).options[0].price).toBe(36);
      await expect(f.accept(b.freightQuoteToken!)).rejects.toThrow('FREIGHT_REQUOTE_REQUIRED');
      await prisma.loja.update({ where: { id: f.lojaID }, data: { originCep: '01001000' } });
      await expect(engine.calculate(f.params)).rejects.toThrow('FREIGHT_OPTIONS_UNAVAILABLE');
    } finally { await prisma.jtExpressRate.delete({ where: { id: rate.id } }); await prisma.jtExpressGeocom.delete({ where: { id: g.id } }); }
  });
  it('unidentified legacy local rule and homonymous city in another UF cannot authorize delivery', async () => {
    const f = await fixture(false); const rule = await prisma.freightRule.create({ data: { lojaID: f.lojaID, cityName: 'São Paulo', value: 0 } });
    await expect(f.quote()).rejects.toThrow('FREIGHT_OPTIONS_UNAVAILABLE');
    expect(await prisma.freightRule.findUniqueOrThrow({ where: { id: rule.id } })).toMatchObject({ state: null, municipalityCode: null });
    await updateFreightRule({ lojaID: f.lojaID, id: rule.id, actorId: f.user.id, state: 'SP', municipalityCode: '3550308' });
    const engine = new FreightOrchestratorService([new CustomTableProvider()], async cep => ({ cep, state: 'MG', city: 'São Paulo', municipalityCode: '3106200' }));
    await expect(engine.calculate(f.params)).rejects.toThrow('FREIGHT_OPTIONS_UNAVAILABLE');
    expect((await f.quote()).options[0].price).toBe(0);
  });
  it('enabled PICKUP/NONE are explicit free policies; disabling revokes them before side effects', async () => {
    const f = await fixture(); await prisma.loja.update({ where: { id: f.lojaID }, data: { enablePickup: true, enableNoFreight: true } });
    expect((await f.purchase(undefined, { deliveryType: 'PICKUP', shippingCost: 900 })).order.shippingCost).toBe(0);
    expect((await f.purchase(undefined, { deliveryType: 'NONE' })).order.shippingCost).toBe(0);
    await prisma.loja.update({ where: { id: f.lojaID }, data: { enablePickup: false, enableNoFreight: false } });
    const before = await effects(f);
    await expect(f.purchase(undefined, { deliveryType: 'PICKUP' })).rejects.toThrow('FREIGHT_METHOD_DISABLED');
    await expect(f.purchase(undefined, { deliveryType: 'NONE' })).rejects.toThrow('FREIGHT_METHOD_DISABLED'); expect(await effects(f)).toEqual(before);
  });
  it('provider failure, invalid price and no available service never create a free quote', async () => {
    const f = await fixture(false);
    for (const calc of [async () => { throw new Error('private-provider-error'); }, async () => [option(-1)], async () => [option(NaN)], async () => []]) {
      await expect(new FreightOrchestratorService([provider(calc)], geo).calculate(f.params)).rejects.toThrow('FREIGHT_OPTIONS_UNAVAILABLE');
    }
    expect(await prisma.freightQuote.count({ where: { lojaID: f.lojaID } })).toBe(0);
  });
  it('partial provider failure does not cache a degraded result and retries on the next request', async () => {
    const f = await fixture(); const calc = vi.fn(async () => { throw new Error('timeout'); });
    const engine = new FreightOrchestratorService([provider(calc), new CustomTableProvider()], geo);
    expect((await engine.calculate(f.params)).options[0].price).toBe(15);
    expect((await engine.calculate(f.params)).options[0].price).toBe(15); expect(calc).toHaveBeenCalledTimes(2);
  });
  it('configuration changed during provider I/O is rejected before any token is minted', async () => {
    const f = await fixture(); let release!: () => void; let entered!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
    const engine = new FreightOrchestratorService([provider(async () => { entered(); await gate; return [option()]; })], geo);
    const pending = engine.calculate(f.params); const rejected = expect(pending).rejects.toThrow('FREIGHT_REQUOTE_REQUIRED');
    await ready; await updateFreightRule({ id: f.rule!.id, lojaID: f.lojaID, actorId: f.user.id, value: 25 }); release(); await rejected;
    expect(await prisma.freightQuote.count({ where: { lojaID: f.lojaID } })).toBe(0);
  });
  it('expiry is evaluated with DB clock after waiting on a store lock', async () => {
    const f = await fixture(); const q = (await f.quote()).options[0];
    const row = await prisma.freightQuote.update({ where: { id: q.freightQuoteId }, data: { expiresAt: new Date(Date.now() + 1500) } });
    const token = signFreightQuote({ quoteId: row.id, expiresAt: row.expiresAt.getTime(), bindingHash: freightQuoteBinding(row) });
    let entered!: () => void; let release!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
    const holder = prisma.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM "Loja" WHERE id = ${f.lojaID} FOR UPDATE`; entered(); await gate; });
    await ready; const pending = f.accept(token); const rejected = expect(pending).rejects.toThrow('FREIGHT_REQUOTE_REQUIRED');
    await new Promise(resolve => setTimeout(resolve, 1700)); release(); await holder; await rejected;
    expect(await effects(f)).toEqual({ stock: 20, orders: 0, buyers: 0 });
  });
  it('audit failure rolls back local-rule mutation and persisted revision atomically', async () => {
    const f = await fixture(); const before = await prisma.loja.findUniqueOrThrow({ where: { id: f.lojaID } });
    const constraint = 'wf11_' + randomUUID().replaceAll('-', '');
    if (!/^[a-zA-Z0-9_-]+$/.test(f.user.id)) throw new Error('Invalid fixture actor');
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("actorId" <> '${f.user.id}' OR action <> 'FREIGHT_RULE_UPDATED')`);
    try { await expect(updateFreightRule({ lojaID: f.lojaID, id: f.rule!.id, actorId: f.user.id, value: 50 })).rejects.toThrow(); }
    finally { await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`); }
    expect((await prisma.freightRule.findUniqueOrThrow({ where: { id: f.rule!.id } })).value.toNumber()).toBe(15);
    expect((await prisma.loja.findUniqueOrThrow({ where: { id: f.lojaID } })).configurationVersion).toBe(before.configurationVersion);
    await deleteFreightRule(f.rule!.id, f.lojaID, f.user.id); await expect(f.quote()).rejects.toThrow('FREIGHT_OPTIONS_UNAVAILABLE');
  });
  it('alternate cart purchase uses current catalog value for merchandise and accepted freight', async () => {
    const f = await fixture(); const cart = await addToCart(f.user.id, { productID: f.product.id, variantID: f.items[0].variantId, quantity: 1, commandId: randomUUID() }, f.lojaID);
    await prisma.product.update({ where: { id: f.product.id }, data: { price: 120 } });
    const q = (await f.quote()).options[0];
    const { neighborhood, ...deliveryAddress } = address;
    const a = await prisma.address.create({ data: { userID: f.user.id, ...deliveryAddress, district: neighborhood } });
    const created = await createOrderFromCart({ userID: f.user.id, lojaID: f.lojaID, cartID: cart.id, addressID: a.id, freightQuoteToken: q.freightQuoteToken });
    expect(Number(created.subtotal)).toBe(120); expect(Number(created.items[0].price)).toBe(120); expect(Number(created.total)).toBe(135);
  });
  it('real HTTP requires host identity, emits private owner-bound PICKUP quote and accepts no client monetary authority', async () => {
    const f = await fixture(); await prisma.loja.update({ where: { id: f.lojaID }, data: { enablePickup: true } });
    const store = await prisma.loja.findUniqueOrThrow({ where: { id: f.lojaID } });
    const cookie = 'session_id=' + (await prisma.session.create({ data: { userId: f.user.id, expiresAt: new Date(Date.now() + 600000) } })).id;
    const opts = { headers: { Host: store.slug + '.plataforma.com', Cookie: cookie } };
    for (const route of ['/api/freight', '/api/freight/calculate']) {
      const result = await post(route, { lojaID: f.lojaID, deliveryType: 'PICKUP', items: [{ ...f.items[0], price: 0, weightInGrams: 1 }] }, opts);
      expect(result.status).toBe(200); expect(result.headers?.['cache-control']).toContain('no-store');
      const data = (result.body as { data: { merchandiseSubtotal: string; options: FreightOption[] } }).data;
      expect(data.merchandiseSubtotal).toBe('100.00'); expect(data.options[0].freightQuoteToken).toBeTruthy();
      expect(JSON.stringify(result.body)).not.toContain(f.ownerKey);
    }
    expect((await post('/api/freight/calculate', { lojaID: randomUUID(), deliveryType: 'PICKUP', items: f.items }, opts)).status).toBe(403);
    expect((await get('/api/freight?city=São%20Paulo', opts)).status).toBe(410);
    const failed = await post('/api/checkout', { lojaID: f.lojaID, customer: { name: f.user.name, email: f.user.email, phone: '11999999999', cpfCnpj: '52998224725' },
      items: f.items.map(item => ({ ...item, name: 'Mercadoria', price: 100 })), deliveryType: 'DELIVERY', address, paymentMethod: 'WHATSAPP_PIX', shippingCost: 0 }, opts);
    expect(failed.status).toBe(422); expect(await effects(f)).toEqual({ stock: 20, orders: 0, buyers: 0 });
  });
});
