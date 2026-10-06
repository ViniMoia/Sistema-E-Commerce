import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createTestCustomer, createTestOrder } from '@/tests/setup/factories';
import { CommerceLocks } from '@/lib/commerce/locks';

let lojaID: string; let otherLojaID: string; let userId: string; let otherUserId: string; let orderId: string;
const jobs: string[] = [];
beforeAll(async () => {
  await verifyTestDatabase();
  lojaID = await createFixtureStore(); otherLojaID = await createFixtureStore();
  userId = (await createTestCustomer({ lojaID })).id;
  otherUserId = (await createTestCustomer({ lojaID: otherLojaID })).id;
  orderId = (await createTestOrder({ lojaID, userID: userId, deliveryType: 'PICKUP' })).id;
});
afterAll(async () => {
  await prisma.paymentInbox.deleteMany({ where: { id: { in: jobs } } });
  await cleanupFixtureStores(); await prisma.$disconnect();
});

describe('WF-04: constraints no PostgreSQL real', () => {
  it('locks ordenados serializam duas revisões reais e recusam inversões', async () => {
    const cart = await prisma.cart.create({ data: { userID: userId, lojaID } });
    const revise = () => prisma.$transaction(async tx => {
      const locks = new CommerceLocks(tx);
      expect(await locks.acquire('cart', [cart.id])).toEqual([cart.id]);
      const before = await tx.cart.findUniqueOrThrow({ where: { id: cart.id } });
      return (await tx.cart.update({ where: { id: cart.id }, data: { version: before.version + 1 } })).version;
    });
    expect((await Promise.all([revise(), revise()])).sort()).toEqual([1, 2]);
    await prisma.$transaction(async tx => {
      const locks = new CommerceLocks(tx);
      const first = locks.acquire('cart', [cart.id]);
      await expect(locks.acquire('order', [orderId])).rejects.toThrow('concorrente');
      await first;
    });
    await prisma.$transaction(async tx => {
      const locks = new CommerceLocks(tx);
      await locks.acquire('order', [orderId]);
      await expect(locks.acquire('cart', [cart.id])).rejects.toThrow('Inversão');
    });
    await prisma.cart.update({ where: { id: cart.id }, data: { status: 'ABANDONED', version: { increment: 1 } } });
  });
  it('comprador não pode vincular conta de outra loja, mesmo sem passar pelo serviço', async () => {
    const data = { lojaID, name: 'Comprador', email: 'buyer@example.invalid' };
    await expect(prisma.orderBuyer.create({ data: { ...data, authenticatedUserID: otherUserId } })).rejects.toThrow();
    const buyer = await prisma.orderBuyer.create({ data: { ...data, authenticatedUserID: userId } });
    expect(buyer.authenticatedUserID).toBe(userId);
    const otherBuyer = await prisma.orderBuyer.create({ data: { ...data, lojaID: otherLojaID } });
    await expect(prisma.order.update({ where: { id: orderId }, data: { buyerID: otherBuyer.id } })).rejects.toThrow();
  });
  it('ator humano legado permanece válido e ator de sistema não exige User fictício', async () => {
    await prisma.auditLog.create({ data: { action: 'TEST', entity: 'ORDER', entityId: orderId, targetId: userId, actorId: userId } });
    const log = await prisma.auditLog.create({ data: { action: 'TEST', entity: 'ORDER', entityId: orderId,
      targetId: userId, actorType: 'SYSTEM', systemActor: 'ASAAS_WEBHOOK', effectKey: randomUUID() } });
    expect(log.actorId).toBeNull();
    await prisma.orderStatusHistory.create({ data: { orderId, status: 'PENDING', actorType: 'SYSTEM', systemActor: 'ORDER_TIMEOUT' } });
    await expect(prisma.auditLog.create({ data: { action: 'TEST', entity: 'ORDER', entityId: orderId,
      actorType: 'SYSTEM', actorId: userId, systemActor: 'ASAAS_WEBHOOK' } })).rejects.toThrow();
    await expect(prisma.orderStatusHistory.create({ data: { orderId, status: 'PENDING', actorType: 'SYSTEM' } })).rejects.toThrow();
  });
  it('intenção é única por dono/loja/chave e por versão consumível do carrinho', async () => {
    const cart = await prisma.cart.create({ data: { userID: userId, lojaID } });
    const data = { lojaID, userID: userId, ownerKey: `user:${userId}`, key: randomUUID(), cartID: cart.id,
      cartVersion: cart.version, snapshot: {}, contentHash: 'a'.repeat(64), expiresAt: new Date(Date.now() + 60000) };
    const results = await Promise.allSettled([prisma.checkoutIntent.create({ data }), prisma.checkoutIntent.create({ data: { ...data, key: randomUUID() } })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma.checkoutIntent.create({ data: { ...data, cartID: null, cartVersion: 0 } })).rejects.toThrow();
    const detached = { ...data, cartID: null, cartVersion: null, key: randomUUID() };
    await prisma.checkoutIntent.create({ data: detached });
    await expect(prisma.checkoutIntent.create({ data: detached })).rejects.toThrow();
  });
  it('reserva não pode usar variante de outro produto nem quantidade zero', async () => {
    const product = await prisma.product.create({ data: { lojaID, userID: userId, name: 'Produto', description: '',
      imageUrl: '', price: 10, stock: 1, productVariants: { create: { size: 'Único', color: 'Padrão', stock: 1 } } }, include: { productVariants: true } });
    const other = await prisma.product.create({ data: { lojaID, userID: userId, name: 'Outro', description: '', imageUrl: '', price: 10, stock: 1 } });
    const item = await prisma.orderItem.create({ data: { orderId, productId: product.id, productVariantsId: product.productVariants[0].id, name: 'Produto', quantity: 1, price: 10 } });
    const data = { orderId, orderItemId: item.id, productId: product.id, variantId: product.productVariants[0].id, quantity: 1 };
    await expect(prisma.inventoryReservation.create({ data: { ...data, productId: other.id } })).rejects.toThrow();
    await expect(prisma.inventoryReservation.create({ data: { ...data, quantity: 0 } })).rejects.toThrow();
    await prisma.inventoryReservation.create({ data });
  });
  it('efeito financeiro duplicado é recusado e dois estornos parciais distintos são preservados', async () => {
    const data = { orderId, provider: 'TEST', type: 'REFUNDED' as const, amount: '2.50', occurredAt: new Date() };
    const key = randomUUID();
    await prisma.financialFact.create({ data: { ...data, factKey: key } });
    await expect(prisma.financialFact.create({ data: { ...data, factKey: key } })).rejects.toThrow();
    await prisma.financialFact.create({ data: { ...data, factKey: randomUUID() } });
    expect(await prisma.financialFact.count({ where: { orderId } })).toBe(2);
  });
  it('lote não pode ficar negativo ou exceder crédito; origem permite devoluções distribuídas', async () => {
    const wallet = await prisma.loyaltyWallet.create({ data: { lojaID, userID: userId, balance: 10 } });
    const transaction = await prisma.loyaltyTransaction.create({ data: { lojaID, userID: userId, type: 'ADMIN_ADJUSTMENT',
      points: 10, balanceAfter: 10, description: 'Teste' } });
    const data = { walletId: wallet.id, sourceTransactionId: transaction.id, sourceKey: 'primary', credited: 10, remaining: 10 };
    const lot = await prisma.loyaltyLot.create({ data });
    await expect(prisma.loyaltyLot.update({ where: { id: lot.id }, data: { remaining: -1 } })).rejects.toThrow();
    await expect(prisma.loyaltyLot.update({ where: { id: lot.id }, data: { remaining: 11 } })).rejects.toThrow();
    await expect(prisma.loyaltyLot.create({ data })).rejects.toThrow();
  });
  it('inbox deduplica evento e exige lease completo; não marca conclusão ao receber', async () => {
    const data = { provider: 'TEST', eventId: randomUUID(), eventType: 'TEST', payload: { safe: true } };
    const event = await prisma.paymentInbox.create({ data }); jobs.push(event.id);
    expect(event.status).toBe('READY'); expect(event.completedAt).toBeNull();
    await expect(prisma.paymentInbox.create({ data })).rejects.toThrow();
    await expect(prisma.paymentInbox.update({ where: { id: event.id }, data: { status: 'LEASED' } })).rejects.toThrow();
    const leased = await prisma.paymentInbox.update({ where: { id: event.id }, data: { status: 'LEASED', leaseOwner: 'worker', leaseExpiresAt: new Date(Date.now() + 60000) } });
    expect(leased.status).toBe('LEASED');
  });
});
