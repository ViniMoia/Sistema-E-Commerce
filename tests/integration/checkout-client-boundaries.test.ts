import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createOrder, type CreateOrderParams } from '@/tests/setup/checkout-fixture';
import { fixtureFreightQuote } from '@/tests/setup/freight-fixture';
import { getCart, addToCart } from '@/services/cart.service';
import { purchaseResultFromOrder, purchaseInclude } from '@/lib/commerce/purchase-result';
import type { PaymentGateway, PaymentMethod } from '@/types/payment-gateway.types';

let lojaID: string, adminID: string, userID: string, productID: string, variantID: string;
const shipping = { cep: '01001000', state: 'SP', city: 'São Paulo', street: 'Rua de entrega', neighborhood: 'Centro', number: '10' };
const billing = { cep: '20040002', state: 'RJ', city: 'Rio de Janeiro', street: 'Rua de cobrança', neighborhood: 'Centro', number: '22' };
const card = { holderName: 'CLIENTE FIXTURE', number: '4532015112830366', expiryMonth: '12', expiryYear: '2030', ccv: '123' };
function gateway(): PaymentGateway {
  return {
    capabilities: vi.fn(async () => ({ configured: true, methods: ['PIX','BOLETO','CREDIT_CARD'] as PaymentMethod[], maximumInstallments: 1 })),
    createPixCharge: vi.fn(async input => ({ paymentId: randomUUID(), value: input.value, status: 'PENDING', pixPayload: 'fixture-pix', pixQrCodeBase64: 'fixture-qr', expiresAt: '2030-10-05T12:00:00Z' })),
    createBoletoCharge: vi.fn(async input => ({ paymentId: randomUUID(), value: input.value, status: 'PENDING', bankSlipUrl: 'https://example.invalid/boleto', digitableLine: 'fixture-line', dueDate: '2030-10-05' })),
    createCreditCardCharge: vi.fn(async input => { const paymentId = randomUUID(); return { paymentId, value: input.value, status: 'CONFIRMED',
      contractId: randomUUID(), charges: [{ paymentId, ordinal: 1, value: input.value, status: 'CONFIRMED' }], approvedForEntireContract: true }; }),
    getPaymentStatus: vi.fn(async () => { throw new Error('No external network in fixture'); }),
  };
}
beforeAll(async () => {
  await verifyTestDatabase(); lojaID = await createFixtureStore();
  await prisma.loja.update({ where: { id: lojaID }, data: { enablePix: true, enableBoleto: true, enableCreditCard: true, enablePickup: true } });
  adminID = (await prisma.user.create({ data: { lojaID, name: 'Admin', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } })).id;
  userID = (await prisma.user.create({ data: { lojaID, name: 'Cliente', email: randomUUID() + '@example.invalid', password: '' } })).id;
  const product = await prisma.product.create({ data: { lojaID, userID: adminID, name: 'Produto WF15', description: '', imageUrl: '', price: 100, stock: 100,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 100 } } }, include: { productVariants: true } });
  productID = product.id; variantID = product.productVariants[0].id;
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
const items = () => [{ productId: productID, variantId: variantID, quantity: 1 }];
const input = (): CreateOrderParams => ({ lojaID, customer: { name: 'Cliente', email: randomUUID() + '@example.invalid', phone: '11999999999', cpfCnpj: '52998224725' },
  items: items(), deliveryType: 'PICKUP', paymentMethod: 'WHATSAPP_PIX' });
describe('WF-15: client/server boundaries with real PostgreSQL and controlled external ports', () => {
  it.each(['PIX','WHATSAPP_PIX','BOLETO','CREDIT_CARD'].flatMap(method => ['DELIVERY','PICKUP','NONE'].map(delivery => [method, delivery])))
    ('preserves independent addresses for %s / %s', async (method, delivery) => {
      const port = gateway(); const args: CreateOrderParams = { ...input(), paymentMethod: method as CreateOrderParams['paymentMethod'],
        deliveryType: delivery as CreateOrderParams['deliveryType'], paymentGateway: port, billingAddress: billing };
      if (delivery === 'DELIVERY') {
        args.shippingAddress = shipping; args.freightOwnerKey = 'g:' + randomUUID().replaceAll('-', '').repeat(2);
        args.freightQuoteToken = await fixtureFreightQuote({ lojaID, ownerKey: args.freightOwnerKey, items: items() });
      }
      if (method === 'CREDIT_CARD') { args.creditCard = card; args.installments = 1; args.acceptedFinancialTotal = delivery === 'DELIVERY' ? 115 : 100; }
      const result = await createOrder(args);
      const order = await prisma.order.findUniqueOrThrow({ where: { id: result.order.id }, include: { buyer: true } });
      expect(order.buyer?.billingAddress).toEqual(billing);
      expect(order.buyer?.deliveryAddress).toEqual(delivery === 'DELIVERY' ? shipping : null);
      if (method === 'BOLETO') expect(port.createBoletoCharge).toHaveBeenCalledWith(expect.objectContaining({ customer: expect.objectContaining({ postalCode: billing.cep, addressNumber: billing.number }) }));
      if (method === 'CREDIT_CARD') expect(port.createCreditCardCharge).toHaveBeenCalledWith(expect.objectContaining({ customer: expect.objectContaining({ postalCode: billing.cep, addressNumber: billing.number }) }));
    });
  it('invalid or missing billing is rejected before any persisted buyer/order/reservation', async () => {
    const count = async () => [await prisma.order.count({ where: { lojaID } }), await prisma.orderBuyer.count({ where: { lojaID } }),
      (await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock];
    const before = await count(); const port = gateway();
    await expect(createOrder({ ...input(), paymentMethod: 'BOLETO', paymentGateway: port })).rejects.toThrow('PAYMENT_BOLETO_BILLING_REQUIRED');
    await expect(createOrder({ ...input(), paymentMethod: 'CREDIT_CARD', paymentGateway: port, creditCard: card, acceptedFinancialTotal: 100,
      billingAddress: { ...billing, state: 'ZZ' } })).rejects.toThrow();
    expect(await count()).toEqual(before); expect(port.createBoletoCharge).not.toHaveBeenCalled(); expect(port.createCreditCardCharge).not.toHaveBeenCalled();
  });
  it('cart reload returns current catalog economics without mutating its revision', async () => {
    await addToCart(userID, { productID, variantID, quantity: 1, commandId: randomUUID() }, lojaID);
    const before = await getCart(userID, lojaID);
    await prisma.product.update({ where: { id: productID }, data: { price: 125 } });
    try { const current = await getCart(userID, lojaID); expect(current?.items[0].price).toBe(125); expect(current?.version).toBe(before?.version); }
    finally { await prisma.product.update({ where: { id: productID }, data: { price: 100 } }); }
  });
  it('expired payment instructions never grant a client payment action', async () => {
    const result = await createOrder(input());
    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.order.id }, include: purchaseInclude });
    const dto = purchaseResultFromOrder(order, undefined, new Date('2035-01-01T00:00:00Z'));
    expect(dto.order.allowedActions).toEqual([]); expect(dto.order.pixKey).toBeNull(); expect(dto.order.paymentState).toBe('PROCESSING');
  });
});
