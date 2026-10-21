import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import prisma from '@/lib/prisma';
import { createFulfillmentFixture } from './fulfillment-fixture';
import { createOrder } from './checkout-fixture';
import type { PaymentGateway, RemoteCharge } from '@/types/payment-gateway.types';
import { applyPaymentEvidence } from '@/services/payment/payment-evidence.service';
import { CommerceLocks } from '@/lib/commerce/locks';
import { reconcilePaymentAttempts } from '@/services/payment/payment-worker.service';

export async function boletoRefundFixture(paid = true) {
  const f = await createFulfillmentFixture();
  await prisma.loja.update({ where: { id: f.lojaID }, data: { enableBoleto: true, loyaltyEnabled: true, loyaltyEarnRate: 1 } });
  const product = await prisma.product.create({ data: { lojaID: f.lojaID, userID: f.admin.id, name: 'Boleto fixture', description: '', imageUrl: '', price: 100, stock: 5,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 5 } } }, include: { productVariants: true } });
  const remote: RemoteCharge[] = [];
  const requestUrl = 'https://sandbox.asaas.com/refund/' + randomUUID();
  const gateway: PaymentGateway = {
    capabilities: async () => ({ configured: true, methods: ['BOLETO'], maximumInstallments: 1 }),
    createBoletoCharge: async input => {
      const paymentId = randomUUID();
      remote.push({ paymentId, ordinal: 1, method: 'BOLETO', externalReference: input.orderId, value: 100, status: 'PENDING',
        refundHistory: { complete: true, records: [] } });
      return { paymentId, value: 100, status: 'PENDING', bankSlipUrl: 'https://sandbox.asaas.com/b/fixture', digitableLine: '123', dueDate: '2030-10-25' };
    },
    inspectAttempt: vi.fn(async () => ({ complete: true, charges: structuredClone(remote) })),
    refundBoleto: vi.fn(async () => ({ requestUrl })),
    refundPayment: vi.fn(async () => {}), refundInstallment: vi.fn(async () => {}),
    createPixCharge: async () => { throw new Error('unexpected'); }, createCreditCardCharge: async () => { throw new Error('unexpected'); }, getPaymentStatus: async () => { throw new Error('unexpected'); },
  };
  const purchase = await createOrder({ lojaID: f.lojaID, customer: { userId: f.customer.id, name: f.customer.name, email: f.customer.email, phone: '11999999999', cpfCnpj: '52998224725' },
    items: [{ productId: product.id, variantId: product.productVariants[0].id, quantity: 1 }], deliveryType: 'PICKUP', paymentMethod: 'BOLETO', paymentGateway: gateway,
    address: { cep: '01001000', state: 'SP', city: 'São Paulo', street: 'Rua', number: '1', neighborhood: 'Centro' } });
  const orderId = purchase.order.id;
  const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId } });
  const observe = () => prisma.$transaction(async tx => {
    await new CommerceLocks(tx).acquire('order', [orderId]);
    return applyPaymentEvidence(tx, attempt.id, { complete: true, charges: structuredClone(remote) });
  });
  if (paid) { remote[0].status = 'RECEIVED'; await observe(); }
  return { ...f, product, remote, gateway, orderId, attempt, observe, requestUrl,
    scope: { orderId, lojaID: f.lojaID, userId: f.admin.id },
    command: { orderId, lojaID: f.lojaID, userId: f.admin.id, kind: 'REFUND' as const, commandId: randomUUID(), expectedVersion: 1 },
    tick: async () => { await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { reconcileAfter: new Date(0) } }); return reconcilePaymentAttempts(50, gateway); },
    read: () => prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { reservations: true, paymentAttempts: { include: { operations: true } } } }),
    stock: () => prisma.productVariants.findUniqueOrThrow({ where: { id: product.productVariants[0].id } }),
  };
}
