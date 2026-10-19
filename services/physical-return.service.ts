import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { CommerceLocks } from '@/lib/commerce/locks';
import { physicalReturnSchema, physicalReturnKey, PHYSICAL_RETURN_ACTION } from '@/lib/commerce/physical-return';
import { paymentAccountScope } from '@/lib/commerce/payment-account';

export class PhysicalReturnError extends Error {
  constructor(public code: 'INVALID' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT', message: string) { super(message); }
}
const conflict = (message: string): never => { throw new PhysicalReturnError('CONFLICT', message); };

// The durable, unique order receipt is also consulted by financial reconciliation.
export async function physicalReturnCompleted(tx: Prisma.TransactionClient, orderId: string, attemptId: string) {
  const receipt = await tx.auditLog.findUnique({ where: { effectKey: physicalReturnKey(orderId) } });
  const metadata = receipt?.metadata as { attemptId?: string } | null;
  return receipt?.action === PHYSICAL_RETURN_ACTION && receipt.entityId === orderId && metadata?.attemptId === attemptId;
}

export async function readPhysicalReturn(orderId: string, lojaID: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const order = await tx.order.findFirst({ where: { id: orderId, lojaID }, include: {
      items: true, paymentAttempts: { orderBy: { number: 'desc' }, take: 1 },
    } });
    if (!order) throw new PhysicalReturnError('NOT_FOUND', 'Pedido não encontrado.');
    const receipt = await tx.auditLog.findUnique({ where: { effectKey: physicalReturnKey(orderId) } });
    const attempt = order.paymentAttempts[0];
    return { orderId, version: order.version,
      eligible: !receipt && !!order.checkoutIntentID && ['SHIPPED', 'DELIVERED'].includes(order.status)
        && attempt?.status === 'REFUNDED' && attempt.failureCode === 'PHYSICAL_RETURN_REQUIRED',
      completed: !!receipt && receipt.action === PHYSICAL_RETURN_ACTION,
      receipt: receipt ? { at: receipt.createdAt.toISOString(), result: receipt.newValue } : null,
      items: order.items.map(i => ({ id: i.id, name: i.name, size: i.size, color: i.color, quantity: i.quantity })) };
  }, { isolationLevel: 'RepeatableRead' });
}

export async function completePhysicalReturn(scope: { orderId: string; lojaID: string; actorId: string }, raw: unknown) {
  const parsed = physicalReturnSchema.safeParse(raw);
  if (!parsed.success) throw new PhysicalReturnError('INVALID', 'Conferência de retorno inválida.');
  const input = { ...parsed.data, items: [...parsed.data.items].sort((a,b) => a.orderItemId.localeCompare(b.orderItemId)) };
  const contentHash = createHash('sha256').update(JSON.stringify({ ...scope, ...input })).digest('hex');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${scope.actorId} FOR SHARE`;
    const actor = await tx.user.findUnique({ where: { id: scope.actorId } });
    if (!actor || actor.lojaID !== scope.lojaID || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE')
      throw new PhysicalReturnError('FORBIDDEN', 'Acesso negado ao retorno.');
    const locks = new CommerceLocks(tx);
    await locks.acquire('order', [scope.orderId]);
    const order = await tx.order.findFirst({ where: { id: scope.orderId, lojaID: scope.lojaID }, include: {
      items: true, reservations: true, paymentAttempts: { orderBy: { number: 'desc' }, take: 1 },
    } });
    if (!order) throw new PhysicalReturnError('NOT_FOUND', 'Pedido não encontrado.');
    const key = physicalReturnKey(order.id);
    const receipt = await tx.auditLog.findUnique({ where: { effectKey: key } });
    if (receipt) {
      const metadata = receipt.metadata as { contentHash?: string } | null;
      if (receipt.action !== PHYSICAL_RETURN_ACTION || receipt.actorId !== scope.actorId || metadata?.contentHash !== contentHash)
        conflict('Retorno já registrado. Consulte o comprovante; não faça outra reposição.');
      return { orderId: order.id, replay: true, result: receipt.newValue };
    }
    const attempt = order.paymentAttempts[0];
    if (order.version !== input.expectedVersion) conflict('Pedido alterado; confira a versão atual.');
    if (!order.checkoutIntentID || !['SHIPPED','DELIVERED'].includes(order.status) || !attempt ||
      attempt.status !== 'REFUNDED' || attempt.failureCode !== 'PHYSICAL_RETURN_REQUIRED' ||
      !['ASAAS','MANUAL'].includes(attempt.provider) || (attempt.provider === 'ASAAS' && attempt.providerAccount !== paymentAccountScope()))
      conflict('Retorno exige estorno integral confirmado e revisão física deste pedido.');
    const facts = await tx.financialFact.findMany({ where: { attemptId: attempt.id, type: 'REFUNDED' } });
    if (!facts.length || facts.some(f => f.orderId !== order.id || f.provider !== attempt.provider || f.providerAccount !== attempt.providerAccount)
      || !facts.reduce((sum, f) => sum.add(f.amount), attempt.financialTotal.mul(0)).equals(attempt.financialTotal))
      conflict('Evidência do estorno integral divergente; mantenha a revisão.');
    if (new Set(input.items.map(i=>i.orderItemId)).size !== input.items.length || input.items.length !== order.items.length ||
      order.reservations.length !== order.items.length) conflict('Confira todos os itens e seus vínculos de reserva.');
    for (const item of order.items) {
      const line = input.items.find(i => i.orderItemId === item.id);
      const r = order.reservations.find(r => r.orderItemId === item.id);
      if (!line || line.receivedQuantity !== item.quantity || line.restockQuantity > line.receivedQuantity ||
        !r || r.status !== 'COMMITTED' || r.quantity !== item.quantity || r.productId !== item.productId || r.variantId !== item.productVariantsId)
        conflict('Retorno parcial ou reserva divergente; nenhuma reposição foi feita.');
    }
    await locks.acquire('product', order.reservations.map(r=>r.productId));
    await locks.acquire('variant', order.reservations.map(r=>r.variantId));
    const movements = [];
    for (const r of order.reservations) {
      const product = await tx.product.findUnique({ where: { id: r.productId } });
      const variant = await tx.productVariants.findUnique({ where: { id: r.variantId } });
      if (!product || product.lojaID !== scope.lojaID || !variant || variant.ProductID !== product.id)
        conflict('Produto ou variante divergente; nenhuma reposição foi feita.');
      const line = input.items.find(i=>i.orderItemId === r.orderItemId)!;
      const available = product.retiredAt || variant.retiredAt ? 0 : line.restockQuantity;
      const unavailable = r.quantity - available;
      const data = { stock: { increment: available }, unavailableStock: { increment: unavailable }, inventoryVersion: { increment: 1 } };
      await tx.product.update({ where: { id: product.id }, data });
      await tx.productVariants.update({ where: { id: variant.id }, data });
      await tx.inventoryReservation.update({ where: { id: r.id, version: r.version }, data: {
        status: 'RETURNED', releasedAt: new Date(), version: { increment: 1 },
      } });
      movements.push({ orderItemId: r.orderItemId, reservationId: r.id, productId: product.id, variantId: variant.id,
        received: r.quantity, available, unavailable,
        before: { productStock: product.stock, variantStock: variant.stock, productUnavailable: product.unavailableStock, variantUnavailable: variant.unavailableStock } });
    }
    await tx.order.update({ where: { id: order.id, version: input.expectedVersion }, data: { version: { increment: 1 } } });
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { failureCode: null, version: { increment: 1 } } });
    // Close only this physical review, never unrelated financial warnings or emails.
    // Review entries have no external delivery. Invalidate any old lease so a
    // worker that read the previous failureCode cannot reopen the closed review.
    const reviewKeys = [`payment-review:${attempt.id}:PHYSICAL_RETURN_REQUIRED`,
      ...(attempt.provider === 'MANUAL' ? [`manual-refund:${attempt.id}`] : [])];
    await tx.commerceOutbox.updateMany({ where: { effectKey: { in: reviewKeys },
      commandType: 'PAYMENT_REVIEW', status: { in: ['READY','DEAD_LETTER','LEASED'] } }, data: {
      status: 'COMPLETED', completedAt: new Date(), lastErrorCode: null, leaseOwner: null, leaseExpiresAt: null,
    } });
    const result = { orderVersion: order.version + 1, status: order.status, movements };
    await tx.auditLog.create({ data: { effectKey: key, action: PHYSICAL_RETURN_ACTION, actorType: 'USER', actorId: scope.actorId,
      entity: 'Order', entityId: order.id, previousValue: { status: order.status, version: order.version, failureCode: attempt.failureCode },
      newValue: result, metadata: { schemaVersion: 1, lojaID: scope.lojaID, attemptId: attempt.id,
        commandId: input.commandId, contentHash, inspectionReference: input.inspectionReference, inspection: input.items } } });
    return { orderId: order.id, replay: false, result };
  }, { timeout: 20000 });
}
