import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import type { createFulfillmentFixture } from './fulfillment-fixture';
import { transitionOrder } from '@/lib/commerce/order-command';
import { manualRefund } from '@/services/payment/manual-refund.service';

export async function refundedPhysicalOrder(f: Awaited<ReturnType<typeof createFulfillmentFixture>>, quantity = 1) {
  const o = await f.order('PICKUP', null, quantity);
  const delivered = await transitionOrder({ ...f.context, orderId: o.id, newStatus: 'DELIVERED', expectedVersion: 1, commandId: randomUUID() });
  if (delivered.success === false) throw new Error(delivered.error);
  const scope = { orderId: o.id, lojaID: f.lojaID, userId: f.admin.id, expectedVersion: 2 };
  await manualRefund({ ...scope, commandId: randomUUID(), action: 'REQUEST_REFUND' });
  await manualRefund({ ...scope, commandId: randomUUID(), action: 'CONFIRM_REFUND', bankReference: 'fixture-bank-return' });
  return prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { items: true, reservations: true, paymentAttempts: true } });
}
