import { beforeEach, describe, expect, it, vi } from "vitest";
import { repairVariants, PRIMARY_ID, DUPLICATE_ID, PRODUCT_ID } from "../../scripts/lib/repair-product-variants.mjs";

let tx: any;
let snapshot: any;
let saveBackup: any;
const primary = () => ({ id: PRIMARY_ID, ProductID: PRODUCT_ID, size: "Padrão", color: "Padrão", stock: 10 });
const duplicate = () => ({ ...primary(), id: DUPLICATE_ID });
beforeEach(() => {
  tx = {
    $queryRawUnsafe: vi.fn(),
    productVariants: {
      findMany: vi.fn().mockResolvedValue([primary(), duplicate()]),
      delete: vi.fn(), update: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), delete: vi.fn(), updateMany: vi.fn(),
    },
    orderItem: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
  };
  snapshot = { $transaction: vi.fn((fn: any) => fn(tx)) };
  saveBackup = vi.fn();
});

describe("Saneamento do incidente de variantes", () => {
  it("salva o backup antes de excluir e não soma estoques duplicados", async () => {
    await repairVariants(snapshot, saveBackup);
    expect(saveBackup).toHaveBeenCalledWith({ productId: PRODUCT_ID, variants: [primary(), duplicate()], cartItems: [], orderItems: [] });
    expect(saveBackup.mock.invocationCallOrder[0]).toBeLessThan(tx.productVariants.delete.mock.invocationCallOrder[0]);
    expect(tx.productVariants.update).toHaveBeenCalledWith({
      where: { id: PRIMARY_ID }, data: { size: "Único", color: "Padrão" },
    });
  });
  it("transfere carrinhos e mescla quantidades quando já existe o item primário", async () => {
    tx.cartItem.findMany.mockResolvedValue([
      { id: "original", cartID: "cart-1", variantID: PRIMARY_ID, quantity: 2 },
      { id: "collision", cartID: "cart-1", variantID: DUPLICATE_ID, quantity: 3 },
      { id: "move", cartID: "cart-2", variantID: DUPLICATE_ID, quantity: 1 },
    ]);
    const result = await repairVariants(snapshot, saveBackup);
    expect(result.movedCartItems).toBe(2);
    expect(tx.cartItem.update).toHaveBeenCalledWith({
      where: { id: "original" }, data: { quantity: { increment: 3 } },
    });
    expect(tx.cartItem.delete).toHaveBeenCalledWith({ where: { id: "collision" } });
    expect(tx.cartItem.update).toHaveBeenCalledWith({
      where: { id: "move" }, data: { variantID: PRIMARY_ID },
    });
  });
  it("transfere os vínculos dos pedidos sem alterar snapshots históricos", async () => {
    tx.orderItem.findMany.mockResolvedValue([{ id: "order-item", productVariantsId: DUPLICATE_ID, size: "Padrão" }]);
    const result = await repairVariants(snapshot, saveBackup);
    expect(result.movedOrderItems).toBe(1);
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { productVariantsId: DUPLICATE_ID }, data: { productVariantsId: PRIMARY_ID },
    });
    expect(tx.orderItem.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.productVariants.delete.mock.invocationCallOrder[0]);
  });
  it("é idempotente após o saneamento", async () => {
    tx.productVariants.findMany.mockResolvedValue([{ ...primary(), size: "Único" }]);
    expect(await repairVariants(snapshot, saveBackup)).toMatchObject({ changed: false });
    expect(saveBackup).not.toHaveBeenCalled();
    expect(tx.productVariants.delete).not.toHaveBeenCalled();
  });
  it("interrompe a operação quando o backup falha", async () => {
    saveBackup.mockRejectedValue(new Error("Backup indisponível"));
    await expect(repairVariants(snapshot, saveBackup)).rejects.toThrow("Backup indisponível");
    expect(tx.productVariants.delete).not.toHaveBeenCalled();
  });
  it("interrompe a operação quando encontra variantes inesperadas", async () => {
    tx.productVariants.findMany.mockResolvedValue([primary(), { ...duplicate(), id: "unexpected" }]);
    await expect(repairVariants(snapshot, saveBackup)).rejects.toThrow("inesperadas");
    expect(saveBackup).not.toHaveBeenCalled();
    expect(tx.productVariants.delete).not.toHaveBeenCalled();
  });
  it('refuses current inventory models before any legacy link or stock mutation', async () => {
    tx.productVariants.findMany.mockResolvedValue([{ ...primary(), inventoryVersion: 0 }, duplicate()]);
    await expect(repairVariants(snapshot, saveBackup)).rejects.toThrow('incompatível');
    expect(saveBackup).not.toHaveBeenCalled();
    expect(tx.productVariants.delete).not.toHaveBeenCalled();
    expect(tx.cartItem.update).not.toHaveBeenCalled();
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  });
});
