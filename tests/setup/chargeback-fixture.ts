import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import prisma from '@/lib/prisma';
import { createFulfillmentFixture } from './fulfillment-fixture';
import { createOrder } from './checkout-fixture';
import type { PaymentGateway, RemoteCharge } from '@/types/payment-gateway.types';
import { applyPaymentEvidence } from '@/services/payment/payment-evidence.service';
import { CommerceLocks } from '@/lib/commerce/locks';

export async function chargebackFixture(installments = 1) {
  const f = await createFulfillmentFixture();
  await prisma.loja.update({ where: { id: f.lojaID }, data: { enableCreditCard: true, loyaltyEnabled: true, loyaltyEarnRate: 1 } });
  const product = await prisma.product.create({ data: { lojaID: f.lojaID, userID: f.admin.id, name: 'Produto contestado', description: '', imageUrl: '', price: 100, stock: 5,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 5 } } }, include: { productVariants: true } });
  const remote: RemoteCharge[] = [];
  const gateway: PaymentGateway = {
    capabilities: async () => ({ configured: true, methods: ['CREDIT_CARD'], maximumInstallments: 3 }),
    createCreditCardCharge: async input => {
      const contractId = randomUUID();
      const values = installments === 3 ? [33.33,33.33,33.34] : [100];
      values.forEach((value, index) => remote.push({ paymentId: randomUUID(), ordinal: index + 1, method: 'CREDIT_CARD', externalReference: input.orderId, value, contractId, status: 'PENDING' }));
      return { paymentId: remote[0].paymentId, value: 100, status: 'PENDING', contractId, charges: remote, approvedForEntireContract: false };
    },
    inspectAttempt: vi.fn(async () => ({ complete: true, charges: structuredClone(remote) })),
    refundPayment: vi.fn(async () => {}), refundInstallment: vi.fn(async () => {}), cancelPayment: vi.fn(async () => {}),
    createPixCharge: async () => { throw new Error('unexpected'); }, createBoletoCharge: async () => { throw new Error('unexpected'); }, getPaymentStatus: async () => { throw new Error('unexpected'); },
  };
  const purchase = await createOrder({ lojaID: f.lojaID, customer: { userId: f.customer.id, name: f.customer.name, email: f.customer.email, phone: '11999999999', cpfCnpj: '52998224725' },
    items: [{ productId: product.id, variantId: product.productVariants[0].id, quantity: 1 }], deliveryType: 'PICKUP', paymentMethod: 'CREDIT_CARD', paymentGateway: gateway,
    installments, acceptedFinancialTotal: 100, address: { cep: '01001000', state: 'SP', city: 'São Paulo', street: 'Rua', number: '1', neighborhood: 'Centro' },
    creditCard: { holderName: 'FIXTURE', number: '4532015112830366', expiryMonth: '12', expiryYear: '2030', ccv: '123' } });
  const orderId = purchase.order.id;
  const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId } });
  const observe = () => prisma.$transaction(async tx => {
    await new CommerceLocks(tx).acquire('order', [orderId]);
    return applyPaymentEvidence(tx, attempt.id, { complete: true, charges: structuredClone(remote) });
  });
  remote.forEach(c => { c.status = 'CONFIRMED'; }); await observe();
  return { ...f, product, remote, gateway, orderId, attempt, observe,
    read: () => prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, reservations: true, paymentAttempts: { include: { charges: true, operations: true } } } }),
    stock: () => prisma.productVariants.findUniqueOrThrow({ where: { id: product.productVariants[0].id } }),
  };
}
