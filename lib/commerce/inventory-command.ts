import { createHash } from 'node:crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { CommerceLocks } from './locks';
import { getVariantCombinationKey } from '@/lib/product-variants';

export const inventoryCommandSchema = z.object({
  commandId: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/),
  variantId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),
  mode: z.enum(['ABSOLUTE', 'DELTA', 'REACTIVATE']),
  quantity: z.number().int().min(-2147483647).max(2147483647),
  expectedVersion: z.number().int().min(0).optional(),
  reason: z.string().trim().min(3).max(500),
}).strict().superRefine((value, ctx) => {
  if (value.mode !== 'DELTA' && (value.quantity < 0 || value.expectedVersion === undefined)) ctx.addIssue({ code: 'custom', message: 'Contagem absoluta/reativação exige quantidade não negativa e revisão.' });
  if (value.mode === 'DELTA' && value.quantity === 0) ctx.addIssue({ code: 'custom', message: 'Reposição/baixa deve alterar a quantidade.' });
});
export type InventoryCommand = z.infer<typeof inventoryCommandSchema>;
export class InventoryCommandError extends Error {
  constructor(public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'RETIRED', message: string) { super(message); }
}

/** Server-only administrative command. Neither owner nor tenant comes from the public body. */
export async function adjustInventory(productId: string, lojaID: string, actorId: string, raw: InventoryCommand) {
  const parsed = inventoryCommandSchema.safeParse(raw);
  if (!parsed.success) throw new InventoryCommandError('INVALID_INPUT', 'Comando de estoque inválido.');
  const input = parsed.data;
  return prisma.$transaction(async tx => {
    const actor = await tx.user.findUnique({ where: { id: actorId }, select: { lojaID: true, role: true, status: true } });
    if (!actor || actor.lojaID !== lojaID || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') throw new InventoryCommandError('FORBIDDEN', 'Acesso negado ao ajuste.');
    const locks = new CommerceLocks(tx); await locks.acquire('product', [productId]);
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || product.lojaID !== lojaID) throw new InventoryCommandError('NOT_FOUND', 'Produto não encontrado.');
    if (input.variantId) await locks.acquire('variant', [input.variantId]);
    const variant = input.variantId ? await tx.productVariants.findUnique({ where: { id: input.variantId } }) : null;
    if (input.variantId && (!variant || variant.ProductID !== product.id)) throw new InventoryCommandError('NOT_FOUND', 'Variante não encontrada.');
    const target = variant ?? product;
    const effectKey = `inventory:${createHash('sha256').update(JSON.stringify([lojaID, productId, input.commandId])).digest('hex')}`;
    const contentHash = createHash('sha256').update(JSON.stringify([actorId, input.variantId ?? null, input.mode, input.quantity, input.expectedVersion ?? null, input.reason])).digest('hex');
    const receipt = await tx.auditLog.findUnique({ where: { effectKey } });
    if (receipt) {
      const metadata = receipt.metadata as { contentHash?: string } | null;
      if (receipt.entityId !== productId || receipt.actorId !== actorId || metadata?.contentHash !== contentHash) throw new InventoryCommandError('CONFLICT', 'Identidade já usada por outro ajuste.');
      return { productId, variantId: input.variantId ?? null, stock: target.stock, unavailableStock: target.unavailableStock, inventoryVersion: target.inventoryVersion, replay: true };
    }
    if (input.expectedVersion !== undefined && input.expectedVersion !== target.inventoryVersion) throw new InventoryCommandError('CONFLICT', 'Estoque alterado; preserve o rascunho e confira a contagem atual.');
    if (product.retiredAt && variant) throw new InventoryCommandError('RETIRED', 'Reative primeiro o produto.');
    if (target.retiredAt && input.mode !== 'REACTIVATE') throw new InventoryCommandError('RETIRED', 'Item retirado exige reativação explícita e contagem física.');
    if (input.mode === 'REACTIVATE' && !target.retiredAt) throw new InventoryCommandError('CONFLICT', 'Item já está ativo.');
    if (input.mode === 'REACTIVATE' && variant) {
      const siblings = await tx.productVariants.findMany({ where: { ProductID: product.id, retiredAt: null } });
      if (siblings.some(sibling => sibling.id !== variant.id && getVariantCombinationKey(sibling) === getVariantCombinationKey(variant))) throw new InventoryCommandError('CONFLICT', 'Combinação já está ativa.');
    }
    const stock = input.mode === 'DELTA' ? target.stock + input.quantity : input.quantity;
    if (!Number.isSafeInteger(stock) || stock < 0 || stock > 2147483647) throw new InventoryCommandError('INVALID_INPUT', 'Quantidade resultante inválida.');
    const data = { stock, inventoryVersion: { increment: 1 }, ...(input.mode === 'REACTIVATE' ? {
      retiredAt: null, unavailableStock: { decrement: Math.min(target.unavailableStock, stock) },
      ...(!variant ? { catalogVersion: { increment: 1 } } : {}),
    } : {}) };
    const updated = variant ? await tx.productVariants.update({ where: { id: variant.id, inventoryVersion: variant.inventoryVersion }, data })
      : await tx.product.update({ where: { id: product.id, inventoryVersion: product.inventoryVersion }, data });
    if (variant) await tx.product.update({ where: { id: product.id }, data: { inventoryVersion: { increment: 1 }, ...(input.mode === 'REACTIVATE' ? { catalogVersion: { increment: 1 } } : {}) } });
    await tx.auditLog.create({ data: { action: 'INVENTORY_ADJUSTED', actorType: 'USER', actorId, targetId: actorId, entity: 'Product', entityId: product.id, effectKey,
      previousValue: { stock: target.stock, unavailableStock: target.unavailableStock, inventoryVersion: target.inventoryVersion, retiredAt: target.retiredAt?.toISOString() ?? null },
      newValue: { stock: updated.stock, unavailableStock: updated.unavailableStock, inventoryVersion: updated.inventoryVersion, retiredAt: updated.retiredAt?.toISOString() ?? null },
      metadata: { lojaID, variantId: input.variantId ?? null, reason: input.reason, mode: input.mode, contentHash } } });
    return { productId, variantId: input.variantId ?? null, stock: updated.stock, unavailableStock: updated.unavailableStock, inventoryVersion: updated.inventoryVersion, replay: false };
  });
}
