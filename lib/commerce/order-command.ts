import { createHash } from 'node:crypto';
import { OrderStatus, type Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { CommerceLocks } from './locks';
import { commerceActorSchema, type CommerceActor } from './contracts';
import { isValidTransition } from '@/lib/order-transitions';
import { allowedOrderActions, fulfillmentPaymentError, normalizeTracking, trackingPolicy } from './order-fulfillment';
import { InventoryService, type InventoryRelease } from '@/services/inventory.service';
import { creditEarnedPoints, refundOrderPoints } from '@/services/loyalty.service';
import type { UpdateOrderStatusInput, UpdateStatusResult } from '@/types/admin.types';

const legacySystemActors: Record<string, CommerceActor> = {
  ASAAS_GATEWAY: { type: 'SYSTEM', code: 'PAYMENT_GATEWAY' },
  ASAAS_GATEWAY_EXPIRATION: { type: 'SYSTEM', code: 'PAYMENT_RECONCILIATION' },
  SYSTEM_CRON_TIMEOUT: { type: 'SYSTEM', code: 'ORDER_TIMEOUT' },
  SYSTEM: { type: 'SYSTEM', code: 'CHECKOUT_COMPENSATION' },
  CHECKOUT_PAYMENT_FAILURE: { type: 'SYSTEM', code: 'CHECKOUT_COMPENSATION' },
};
const selection = { id: true, status: true, version: true, orderNumber: true, deliveredConfirmedAt: true, trackingCode: true, shippingProvider: true } as const;

/** Trusted server command. HTTP handlers construct actor/tenant from their session.
 * The payment executor can compose this command in its evidence/inbox transaction.
 */
type CommandInput = Omit<UpdateOrderStatusInput, 'newStatus'> & { lojaID?: string; newStatus?: OrderStatus; trackingOnly: boolean };
export function transitionOrder(input: UpdateOrderStatusInput & { lojaID?: string }, transaction?: Prisma.TransactionClient): Promise<UpdateStatusResult> {
  return executeOrderCommand({ ...input, trackingOnly: false }, transaction);
}
export function updateOrderTracking(input: Omit<UpdateOrderStatusInput, 'newStatus' | 'confirmReceipt' | 'paidAt'> & { lojaID: string; trackingCode: string | null; commandId: string; expectedVersion: number }, transaction?: Prisma.TransactionClient): Promise<UpdateStatusResult> {
  return executeOrderCommand({ ...input, trackingOnly: true }, transaction);
}
async function executeOrderCommand(input: CommandInput, transaction?: Prisma.TransactionClient): Promise<UpdateStatusResult> {
  if (!input.orderId || (!input.trackingOnly && (!input.newStatus || !Object.values(OrderStatus).includes(input.newStatus)))
    || (input.trackingOnly && (input.trackingCode === undefined || !input.commandId || input.expectedVersion === undefined || input.confirmReceipt || input.paidAt))
    || (input.trackingCode !== undefined && input.trackingCode !== null && typeof input.trackingCode !== 'string')
    || (input.shippingProvider !== undefined && input.shippingProvider !== null && typeof input.shippingProvider !== 'string')
    || (input.expectedVersion !== undefined && (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0))
    || (input.commandId !== undefined && !/^[a-zA-Z0-9_-]{1,96}$/.test(input.commandId))) {
    return { success: false, error: 'Comando de pedido inválido.', code: 'INVALID_INPUT' };
  }
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) return { success: false, error: 'Data de pagamento inválida.', code: 'INVALID_INPUT' };

  const apply = async (tx: Prisma.TransactionClient): Promise<UpdateStatusResult> => {
    // Actor lock precedes order lock, as in payment supervision/refunds.
    const userActorId = input.actor?.type === 'USER' ? input.actor.userId : !input.actor && !legacySystemActors[input.performedById] ? input.performedById : null;
    if (userActorId) await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userActorId} FOR SHARE`;
    const locks = new CommerceLocks(tx);
    await locks.acquire('order', [input.orderId]);
    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { items: true, reservations: true } });
    if (!order || (input.lojaID && order.lojaID !== input.lojaID)) return { success: false, error: 'Pedido não encontrado.', code: 'NOT_FOUND' };

    const nextStatus = input.trackingOnly ? order.status : input.newStatus!;
    const rawActor = input.actor ?? (Object.prototype.hasOwnProperty.call(legacySystemActors, input.performedById)
      ? legacySystemActors[input.performedById] : { type: 'USER', userId: input.performedById, lojaID: input.lojaID ?? order.lojaID });
    const parsed = commerceActorSchema.safeParse(rawActor);
    if (!parsed.success) return { success: false, error: 'Ator inválido.', code: 'INVALID_INPUT' };
    const actor = parsed.data;
    if (input.trackingOnly && actor.type !== 'USER') return { success: false, code: 'FORBIDDEN', error: 'Edição de rastreamento exige Admin.' };
    if (actor.type === 'SYSTEM' && !input.lojaID) return { success: false, error: 'Contexto de loja obrigatório.', code: 'INVALID_INPUT' };
    if (actor.type === 'USER') {
      const user = await tx.user.findUnique({ where: { id: actor.userId }, select: { id: true, lojaID: true, status: true, role: true } });
      const ownReceipt = input.confirmReceipt && nextStatus === 'DELIVERED' && user?.id === order.userID;
      if (!user || user.status !== 'ACTIVE' || user.lojaID !== order.lojaID || actor.lojaID !== order.lojaID
        || (input.confirmReceipt && !ownReceipt) || (user.role !== 'ADMIN' && !ownReceipt)) {
        return { success: false, error: 'Acesso negado à transição do pedido.', code: 'FORBIDDEN' };
      }
    } else if (input.confirmReceipt) return { success: false, error: 'Confirmação de recebimento exige o titular.', code: 'FORBIDDEN' };

    if (input.shippingProvider !== undefined && input.shippingProvider !== order.shippingProvider) return { success: false, code: 'CONFLICT', error: 'Transportadora diverge do frete contratado.' };
    if (!input.trackingOnly && input.trackingCode !== undefined && nextStatus !== 'SHIPPED') return { success: false, code: 'INVALID_INPUT', error: 'Use a edição de rastreamento fora da expedição.' };
    const tracking = normalizeTracking(order, input.trackingCode === undefined ? order.trackingCode : input.trackingCode);
    // Historic malformed codes must not block payment, cancellation or receipt.
    if (!tracking.success && (input.trackingOnly || nextStatus === 'SHIPPED' || input.trackingCode !== undefined)) return { success: false, code: 'INVALID_INPUT', error: tracking.error };
    const trackingValue = tracking.success ? tracking.value : order.trackingCode;
    const commandKey = input.commandId ? createHash('sha256').update(JSON.stringify([order.lojaID, order.id, input.commandId])).digest('hex') : null;
    const commandContentHash = commandKey ? createHash('sha256').update(JSON.stringify([
      input.trackingOnly ? 'TRACKING' : nextStatus, input.reason ?? null, input.confirmReceipt ?? false,
      input.expectedVersion ?? null, input.paidAt ? paidAt.toISOString() : null,
      ...(input.trackingOnly || input.trackingCode !== undefined || input.shippingProvider !== undefined
        ? [input.trackingOnly ? 'TRACKING' : 'STATUS', input.trackingCode === undefined ? ['OMITTED'] : ['VALUE', trackingValue],
          input.shippingProvider === undefined ? ['OMITTED'] : ['VALUE', input.shippingProvider]] : []),
    ])).digest('hex') : null;
    if (commandKey) {
      const applied = await tx.orderStatusHistory.findUnique({ where: { commandKey } });
      if (applied) {
        const sameActor = actor.type === 'USER' ? applied.actorType === 'USER' && applied.performedById === actor.userId
          : applied.actorType === 'SYSTEM' && applied.systemActor === actor.code;
        if (applied.orderId !== order.id || (!input.trackingOnly && applied.status !== nextStatus) || !sameActor || applied.commandContentHash !== commandContentHash) return { success: false, error: 'Identidade do comando já usada para outra operação.', code: 'CONFLICT' };
        return { success: true, order: { id: order.id, status: order.status, version: order.version, orderNumber: order.orderNumber, deliveredConfirmedAt: order.deliveredConfirmedAt, trackingCode: order.trackingCode, shippingProvider: order.shippingProvider } };
      }
    }
    if (input.expectedVersion !== undefined && input.expectedVersion !== order.version) return { success: false, error: 'Pedido alterado por outra operação.', code: 'CONFLICT' };
    const attempt = order.financialPlan || order.checkoutIntentID
      ? await tx.paymentAttempt.findFirst({ where: { orderId: order.id }, orderBy: { number: 'desc' } }) : null;
    if (input.trackingOnly) {
      if (!allowedOrderActions(order, attempt, 'ADMIN').tracking.editable) return { success: false, code: 'INVALID_TRANSITION', error: 'Este pedido não permite editar o rastreamento neste estado.' };
    } else {
      if (order.status === nextStatus) {
        if (input.trackingCode !== undefined && trackingValue !== order.trackingCode) return { success: false, code: 'CONFLICT', error: 'Pedido já expedido. Recarregue e use a edição de rastreamento.' };
        return { success: true, order: { id: order.id, status: order.status, version: order.version, orderNumber: order.orderNumber, deliveredConfirmedAt: order.deliveredConfirmedAt, trackingCode: order.trackingCode, shippingProvider: order.shippingProvider } };
      }
      if (!isValidTransition(order.status, nextStatus, order.deliveryType)) return { success: false, error: 'Transição de status inválida.', code: 'INVALID_TRANSITION' };
      const financialError = fulfillmentPaymentError(order, nextStatus, actor.type, attempt);
      if (financialError) return { success: false, code: 'CONFLICT', error: financialError };
    }
    if (trackingPolicy(order).required && ['SHIPPED', 'DELIVERED'].includes(nextStatus) && !trackingValue
      && (input.trackingOnly || nextStatus === 'SHIPPED')) return { success: false, code: 'INVALID_INPUT', error: 'Código de rastreamento obrigatório para expedição pelos Correios.' };
    const manual = order.checkoutIntentID && order.paymentMethod === 'WHATSAPP_PIX' ? attempt : null;
    let inventoryReleases: InventoryRelease[] = [];
    if (!input.trackingOnly && nextStatus === 'CANCELLED') {
      if (order.checkoutIntentID && (order.reservations.length !== order.items.length || order.reservations.some(r => !['RESERVED', 'COMMITTED'].includes(r.status)))) {
        return { success: false, code: 'CONFLICT', error: 'INVENTORY_RESERVATION_REVIEW_REQUIRED' };
      }
      const sourceItems = order.checkoutIntentID ? order.reservations.map(r => ({ productId: r.productId, productVariantsId: r.variantId, quantity: r.quantity })) : order.items;
      const products = sourceItems.flatMap(item => item.productId ? [item.productId] : []);
      const variants = sourceItems.flatMap(item => item.productVariantsId ? [item.productVariantsId] : []);
      await locks.acquire('product', products); await locks.acquire('variant', variants);
      inventoryReleases = await InventoryService.restoreStock(sourceItems.map(item => ({ productId: item.productId ?? '', variantId: item.productVariantsId, quantity: item.quantity })), tx, order.lojaID);
      for (const reservation of order.reservations ?? []) await tx.inventoryReservation.update({ where: { id: reservation.id, version: reservation.version },
        data: { status: reservation.status === 'COMMITTED' ? 'RETURNED' : 'RELEASED', releasedAt: new Date(), version: { increment: 1 } } });
      if (order.userID && (order.status === 'PAID' || order.pointsRedeemed > 0)) {
        await refundOrderPoints({ lojaID: order.lojaID, orderId: order.id, reason: input.reason }, tx);
      }
    }
    if (!input.trackingOnly && nextStatus === 'PAID' && order.checkoutIntentID) {
      if (order.reservations.length !== order.items.length || order.reservations.some(r => r.status !== 'RESERVED')) return { success: false, code: 'CONFLICT', error: 'INVENTORY_RESERVATION_REVIEW_REQUIRED' };
      await tx.inventoryReservation.updateMany({ where: { orderId: order.id, status: 'RESERVED' }, data: { status: 'COMMITTED', version: { increment: 1 } } });
    }
    if (manual && !input.trackingOnly && nextStatus === 'PAID') {
      await tx.paymentAttempt.update({ where: { id: manual.id }, data: { status: 'APPROVED', version: { increment: 1 }, failureCode: null } });
      const factKey = 'manual:' + order.id + ':AUTHORIZED';
      await tx.financialFact.upsert({ where: { provider_factKey: { provider: 'MANUAL', factKey } }, update: {}, create: {
        provider: 'MANUAL', factKey, type: 'AUTHORIZED', orderId: order.id, attemptId: manual.id, amount: manual.financialTotal, occurredAt: paidAt } });
    } else if (manual && !input.trackingOnly && nextStatus === 'CANCELLED' && !['REFUNDED','CANCELLED'].includes(manual.status)) {
      const refundPending = ['PAID','SHIPPED','DELIVERED'].includes(order.status);
      await tx.paymentAttempt.update({ where: { id: manual.id }, data: { status: refundPending ? 'REFUND_PENDING' : 'CANCELLED',
        version: { increment: 1 }, failureCode: refundPending ? 'MANUAL_REFUND_REVIEW' : null } });
      if (refundPending) await tx.commerceOutbox.upsert({ where: { effectKey: 'manual-refund:' + manual.id }, update: {}, create: {
        effectKey: 'manual-refund:' + manual.id, commandType: 'PAYMENT_REVIEW', aggregateId: order.id,
        payload: { schemaVersion: 1, attemptId: manual.id, reasonCode: 'MANUAL_REFUND_VERIFICATION_REQUIRED' } } });
    }
    const updated = await tx.order.update({ where: { id: order.id, version: order.version }, data: {
      status: nextStatus, version: { increment: 1 },
      ...(!input.trackingOnly && nextStatus === 'PAID' ? { paidAt } : {}),
      ...(input.trackingOnly || input.trackingCode !== undefined ? { trackingCode: trackingValue } : {}),
      ...(input.confirmReceipt && actor.type === 'USER' ? { deliveredConfirmedAt: new Date(), deliveredConfirmedBy: actor.userId } : {}),
    }, select: selection });
    if (!input.trackingOnly && nextStatus === 'PAID' && order.userID) {
      await creditEarnedPoints({ lojaID: order.lojaID, userID: order.userID, orderId: order.id, subtotal: Number(order.subtotal) }, tx);
    }
    const effectKey = `order:${order.id}:version:${updated.version}`;
    await tx.auditLog.create({ data: {
      actorType: actor.type, actorId: actor.type === 'USER' ? actor.userId : null,
      systemActor: actor.type === 'SYSTEM' ? actor.code : null, targetId: order.userID,
      action: input.trackingOnly ? 'ORDER_TRACKING_UPDATED' : input.confirmReceipt ? 'ORDER_DELIVERY_CONFIRMED_BY_CUSTOMER' : 'ORDER_STATUS_UPDATED',
      entity: 'Order', entityId: order.id, effectKey,
      previousValue: { status: order.status, version: order.version, trackingCode: order.trackingCode, shippingProvider: order.shippingProvider }, newValue: { status: updated.status, version: updated.version, trackingCode: updated.trackingCode, shippingProvider: updated.shippingProvider },
      ipAddress: input.ipAddress ?? null, metadata: { reason: input.reason ?? null, commandId: input.commandId ?? null, inventoryReleases: inventoryReleases.map(release => ({ ...release })) },
    } });
    await tx.orderStatusHistory.create({ data: { orderId: order.id, orderVersion: updated.version, status: updated.status, previousStatus: order.status,
      actorType: actor.type, performedById: actor.type === 'USER' ? actor.userId : null,
      systemActor: actor.type === 'SYSTEM' ? actor.code : null, commandKey, commandContentHash, ipAddress: input.ipAddress ?? null } });
    await tx.commerceOutbox.create({ data: { effectKey, commandType: 'ORDER_STATUS_CHANGED', aggregateId: order.id,
      payload: { schemaVersion: 1, changeType: input.trackingOnly ? 'TRACKING' : 'STATUS', lojaID: order.lojaID, orderId: order.id, from: order.status, to: updated.status, version: updated.version } } });
    return { success: true, order: updated };
  };
  return transaction ? apply(transaction) : prisma.$transaction(apply);
}
