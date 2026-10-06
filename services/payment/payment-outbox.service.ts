import prisma from '@/lib/prisma';
import { z } from 'zod';
import { emailService, renderOrderPaymentConfirmedEmail } from '@/lib/email';
import { buyerSelect, orderCustomer, snapshotDeliveryAddress } from '@/lib/commerce/order-buyer';
import { paymentNow } from './payment-evidence.service';
import { claimWork, fenceWork, completeWork, retryWork } from './durable-work.service';
import type { Prisma } from '@prisma/client';

const emailSchema = z.object({ deliveryStartedAt: z.string().datetime(),
  options: z.object({ to: z.string().email(), from: z.string().min(1), subject: z.string().min(1), html: z.string(), text: z.string() }).strict() }).strict();

export async function drainPaymentOutbox(limit = 10, send = emailService.sendEmail) {
  const batch = await claimWork('CommerceOutbox', Math.max(1, Math.min(50, Math.trunc(limit))));
  const summary = { claimed: batch.ids.length, completed: 0, retried: 0, review: 0 };
  for (const id of batch.ids) {
    try {
      const entry = await prisma.commerceOutbox.findUniqueOrThrow({ where: { id } });
      if (entry.commandType === 'PAYMENT_REVIEW') {
        const unresolved = await prisma.$transaction(async tx => {
          const payload = entry.payload as { attemptId?: string };
          const attempt = payload.attemptId ? await tx.paymentAttempt.findUnique({ where: { id: payload.attemptId } }) : null;
          const pending = !attempt || !!attempt.failureCode || ['SUBMITTING','UNKNOWN','CANCEL_PENDING','REFUND_PENDING'].includes(attempt.status);
          await completeWork(tx, 'CommerceOutbox', id, batch.owner, pending); return pending;
        });
        if (unresolved) summary.review++; else summary.completed++;
        continue;
      }
      if (entry.commandType === 'ORDER_STATUS_CHANGED' || entry.commandType === 'CHECKOUT_COMMITTED') {
        await prisma.$transaction(async tx => {
          await fenceWork(tx, 'CommerceOutbox', id, batch.owner);
          const payload = entry.payload as { to?: string; from?: string; changeType?: string; orderId?: string };
          if (entry.commandType === 'ORDER_STATUS_CHANGED' && payload.to === 'PAID' && payload.changeType !== 'TRACKING') {
            const effectKey = 'payment-confirmation:' + entry.aggregateId;
            await tx.commerceOutbox.upsert({ where: { effectKey }, create: { effectKey, commandType: 'PAYMENT_CONFIRMATION_EMAIL', aggregateId: entry.aggregateId,
              payload: { schemaVersion: 1, orderId: entry.aggregateId } }, update: {} });
          }
          await completeWork(tx, 'CommerceOutbox', id, batch.owner);
        }); summary.completed++; continue;
      }
      if (entry.commandType !== 'PAYMENT_CONFIRMATION_EMAIL') {
        await prisma.$transaction(tx => completeWork(tx, 'CommerceOutbox', id, batch.owner, true)); summary.review++; continue;
      }
      const frozen = await prisma.$transaction(async tx => {
        await fenceWork(tx, 'CommerceOutbox', id, batch.owner);
        const current = await tx.commerceOutbox.findUniqueOrThrow({ where: { id } });
        const saved = emailSchema.safeParse(current.payload);
        if (saved.success) return saved.data;
        const order = await tx.order.findUniqueOrThrow({ where: { id: entry.aggregateId }, include: {
          buyer: { select: buyerSelect }, user: { select: { name: true, email: true } }, loja: { select: { name: true } }, items: true, address: true } });
        if (!['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status)) return null;
        const buyer = orderCustomer(order), address = order.address ?? snapshotDeliveryAddress(order.buyer);
        const content = renderOrderPaymentConfirmedEmail({ to: buyer.email, customerName: buyer.name, orderNumber: order.orderNumber,
          totalValue: Number(order.financialTotal ?? order.total), paymentDate: order.paidAt ?? order.createdAt,
          items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: Number(i.price), color: i.color, size: i.size })),
          deliveryType: order.deliveryType, shippingServiceName: order.shippingServiceName, shippingEstimatedDays: order.shippingEstimatedDays,
          addressFormatted: address ? [address.street, address.number, address.district, address.city, address.state, address.cep].join(', ') : null,
          pointsEarned: order.pointsCredited, storeName: order.loja.name });
        const snapshot = emailSchema.parse({ deliveryStartedAt: (await paymentNow(tx)).toISOString(), options: {
          to: buyer.email, from: process.env.EMAIL_FROM || 'Continental <nao-responda@continentalestetica.com.br>',
          subject: 'Pagamento Confirmado: Pedido #' + order.orderNumber + ' - ' + order.loja.name, ...content } });
        await tx.commerceOutbox.update({ where: { id }, data: { payload: snapshot as Prisma.InputJsonValue } });
        return snapshot;
      });
      if (!frozen) {
        await prisma.$transaction(tx => completeWork(tx, 'CommerceOutbox', id, batch.owner)); summary.completed++; continue;
      }
      const now = await prisma.$transaction(paymentNow);
      // Resend retains idempotency for 24h. Stop before that window instead of
      // blindly re-sending an email whose first result may have been lost.
      if (now.getTime() - new Date(frozen.deliveryStartedAt).getTime() >= 23 * 3600000) {
        await prisma.$transaction(tx => completeWork(tx, 'CommerceOutbox', id, batch.owner, true)); summary.review++; continue;
      }
      if (send === emailService.sendEmail && !process.env.RESEND_API_KEY) throw new Error('EMAIL_DELIVERY_UNAVAILABLE');
      const result = await send({ ...frozen.options, idempotencyKey: entry.effectKey });
      if (!result.success || !result.messageId) throw new Error('EMAIL_DELIVERY_UNRESOLVED');
      await prisma.$transaction(tx => completeWork(tx, 'CommerceOutbox', id, batch.owner)); summary.completed++;
    } catch { await retryWork('CommerceOutbox', id, batch.owner, 'PAYMENT_OUTBOX_RETRY'); summary.retried++; }
  }
  return summary;
}
