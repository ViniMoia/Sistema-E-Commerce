import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { createFixtureStore } from './fixture-scope';
import { createOrder } from './checkout-fixture';
import { fixtureFreightQuote } from './freight-fixture';
import { transitionOrder } from '@/lib/commerce/order-command';

export async function createFulfillmentFixture() {
  const lojaID = await createFixtureStore();
  await prisma.loja.update({ where: { id: lojaID }, data: { enablePickup: true, enableNoFreight: true } });
  const admin = await prisma.user.create({ data: { lojaID, role: 'ADMIN', name: 'Admin WF16', email: randomUUID() + '@example.invalid', password: '' } });
  const customer = await prisma.user.create({ data: { lojaID, name: 'Cliente WF16', email: randomUUID() + '@example.invalid', password: '' } });
  const session = await prisma.session.create({ data: { userId: admin.id, expiresAt: new Date(Date.now() + 3600000) } });
  const loja = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } });
  const context = { lojaID, performedById: admin.id };
  return { lojaID, admin, customer, session, host: loja.slug + '.plataforma.com', context,
    async order(deliveryType: 'DELIVERY' | 'PICKUP' | 'NONE' = 'DELIVERY', provider: string | null = 'LOCAL_TABLE') {
      const product = await prisma.product.create({ data: { lojaID, userID: admin.id, name: 'Produto WF16', description: '', imageUrl: '', price: 100, stock: 2,
        productVariants: { create: { size: 'Único', color: 'Padrão', stock: 2 } } }, include: { productVariants: true } });
      const items = [{ productId: product.id, variantId: product.productVariants[0].id, quantity: 1 }];
      const freightQuoteToken = deliveryType === 'DELIVERY' ? await fixtureFreightQuote({ lojaID, ownerKey: 'u:' + customer.id, items }) : undefined;
      const purchase = await createOrder({ lojaID, customer: { userId: customer.id, name: customer.name, email: customer.email, phone: '11999999999', cpfCnpj: '52998224725' },
        items, deliveryType, paymentMethod: 'WHATSAPP_PIX', freightQuoteToken,
        ...(deliveryType === 'DELIVERY' ? { shippingAddress: { cep: '01001000', state: 'SP', city: 'São Paulo', neighborhood: 'Centro', street: 'Rua', number: '1' } } : {}) });
      const result = await transitionOrder({ ...context, orderId: purchase.order.id, newStatus: 'PAID', commandId: randomUUID(), expectedVersion: 0 });
      if (result.success === false) throw new Error(result.error);
      // Downstream fulfillment fixture: simulate persisted carrier identity only,
      // without calling external carrier services or bypassing payment approval.
      if (deliveryType === 'DELIVERY') await prisma.order.update({ where: { id: purchase.order.id }, data: { shippingProvider: provider } });
      return prisma.order.findUniqueOrThrow({ where: { id: purchase.order.id } });
    },
  };
}
