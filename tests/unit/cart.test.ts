import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addToCart, getCart } from '@/services/cart.service';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

vi.mock('@/lib/prisma', () => ({ default: {
  $transaction: vi.fn(async cb => cb(prisma)), $queryRaw: vi.fn(async () => []),
  user: { findUnique: vi.fn() }, product: { findUnique: vi.fn() },
  productVariants: { findUniqueOrThrow: vi.fn(), create: vi.fn() },
  cart: { findMany: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
  auditLog: { findUnique: vi.fn(), create: vi.fn() },
  cartItem: { create: vi.fn(), update: vi.fn() },
} }));
const variant = { id: 'var-1', ProductID: 'prod-1', stock: 10, color: 'Padrão', size: 'Único', retiredAt: null };
const product = () => ({ id: 'prod-1', lojaID: 'loja-1', name: 'Produto', price: new Prisma.Decimal('79.90'), imageUrl: '', stock: 10, retiredAt: null, productVariants: [variant] });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));
  vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', lojaID: 'loja-1', status: 'ACTIVE' } as any);
  const cart = { id: 'cart-1', lojaID: 'loja-1', userID: 'user-1', status: 'ACTIVE', version: 0, shippingCost: null, items: [] };
  vi.mocked(prisma.cart.findMany).mockResolvedValue([cart] as any);
  (prisma.cart.findUniqueOrThrow as any).mockResolvedValue(cart);
  vi.mocked(prisma.product.findUnique).mockResolvedValue(product() as any);
  vi.mocked(prisma.productVariants.findUniqueOrThrow).mockResolvedValue(variant as any);
});
describe('Carrinho: escopo, seleção e valores autoritativos', () => {
  it('recusa variante de outro produto antes de criar item', async () => {
    await expect(addToCart('user-1', { productID: 'prod-1', variantID: 'other', quantity: 1, commandId: randomUUID() })).rejects.toThrow('variante válida');
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });
  it('recusa quantidade superior ao estoque', async () => {
    await expect(addToCart('user-1', { productID: 'prod-1', quantity: 11, commandId: randomUUID() })).rejects.toThrow('Insufficient stock');
  });
  it('recusa produto de outra loja mesmo com carrinho vazio', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ ...product(), lojaID: 'loja-2' } as any);
    await expect(addToCart('user-1', { productID: 'prod-1', quantity: 1, commandId: randomUUID() })).rejects.toThrow('não pertence');
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });
  it('grava preço e tenant obtidos no servidor', async () => {
    await addToCart('user-1', { productID: 'prod-1', variantID: 'var-1', quantity: 2, commandId: randomUUID() });
    expect(prisma.cartItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ price: new Prisma.Decimal('79.90'), lojaID: 'loja-1', cartID: 'cart-1', quantity: 2 }) });
  });
  it('resolve seleção neutra legada sem escolher variante esgotada', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ ...product(), productVariants: [{ ...variant, id: 'out', stock: 0 }, { ...variant, size: ' default ', color: ' padrão ' }] } as any);
    await addToCart('user-1', { productID: 'prod-1', quantity: 1, commandId: randomUUID() });
    expect(prisma.cartItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ variantID: 'var-1' }) });
  });
  it('não cria variante de catálogo durante compra de produto sem variantes', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ ...product(), productVariants: [] } as any);
    await expect(addToCart('user-1', { productID: 'prod-1', quantity: 1, commandId: randomUUID() })).rejects.toThrow('variante válida');
    expect(prisma.productVariants.create).not.toHaveBeenCalled();
  });
  it('exige seleção quando a dimensão possui opções distintas', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ ...product(), productVariants: [{ ...variant, size: 'M' }, { ...variant, id: 'var-2', size: 'G' }] } as any);
    await expect(addToCart('user-1', { productID: 'prod-1', quantity: 1, commandId: randomUUID() })).rejects.toThrow('variante válida');
  });
  it('recusa sessão em outra loja e conta bloqueada antes de ler carrinho', async () => {
    await expect(getCart('user-1', 'loja-2')).rejects.toThrow('Conta inválida');
    expect(prisma.cart.findMany).not.toHaveBeenCalled();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', lojaID: 'loja-1', status: 'BLOCKED' } as any);
    await expect(getCart('user-1')).rejects.toThrow('Conta inválida');
  });
  it('creation collision retries a fresh transaction, with the same mutation identity', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Creation collision', {
      code: 'P2002', clientVersion: '5.22', meta: { target: ['lojaID', 'userID'] },
    }));
    await addToCart('user-1', { productID: 'prod-1', quantity: 1, commandId: randomUUID() });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.cartItem.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it('other unique violations are not mistaken for an active cart collision', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Receipt collision', { code: 'P2002', clientVersion: '5.22', meta: { target: ['effectKey'] } });
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(error);
    await expect(addToCart('user-1', { productID: 'prod-1', quantity: 1, commandId: randomUUID() })).rejects.toBe(error);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it('unversioned absolute mutation and inclusion without identity fail before writes', async () => {
    await expect(addToCart('user-1', { productID: 'prod-1', quantity: 1 })).rejects.toThrow('commandId');
    await expect(addToCart('user-1', { productID: 'prod-1', quantity: 1, commandId: randomUUID(), expectedVersion: 0 })).rejects.toThrow('identidade do carrinho');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('persistent creation collision stops after one fresh attempt', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Creation collision', { code: 'P2002', clientVersion: '5.22', meta: { target: ['lojaID', 'userID'] } });
    vi.mocked(prisma.$transaction).mockRejectedValue(error);
    await expect(addToCart('user-1', { productID: 'prod-1', quantity: 1, commandId: randomUUID() })).rejects.toBe(error);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });
});
