import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createProduct, updateProduct as updateCatalog, type UpdateProductInput } from "@/services/product.service";

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: vi.fn(), $queryRaw: vi.fn(),
    loja: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    productVariants: {
      findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

type Row = { id: string; ProductID: string; size: string; color: string; stock: number; unavailableStock: number; inventoryVersion: number; retiredAt: Date | null; carts?: boolean; orders?: boolean };
const row = (id: string, size = "Único", color = "Padrão"): Row =>
  ({ id, ProductID: "product", size, color, stock: 10, unavailableStock: 0, inventoryVersion: 0, retiredAt: null });
let rows: Row[];
let name: string;
let catalogVersion: number;
const updateProduct = (id: string, data: UpdateProductInput, lojaID: string) => updateCatalog(id, { expectedCatalogVersion: catalogVersion, ...data }, lojaID);
const applyData = (target: any, data: any) => {
  for (const [key, value] of Object.entries(data)) target[key] = value && typeof value === 'object' && 'increment' in value ? target[key] + (value as any).increment : value;
};
const product = () => ({
  id: "product", lojaID: "store", name, price: new Prisma.Decimal(10), stock: 10, catalogVersion, inventoryVersion: 0,
  productVariants: rows.map((v) => ({ ...v })),
});

beforeEach(() => {
  vi.resetAllMocks();
  (prisma.$queryRaw as Mock).mockResolvedValue([]);
  rows = [row("original")];
  name = "Produto";
  catalogVersion = 0;
  (prisma.$transaction as Mock).mockImplementation(async (callback: any) => {
    const snapshot = rows.map((v) => ({ ...v }));
    const oldName = name;
    const oldVersion = catalogVersion;
    try { return await callback(prisma); }
    catch (error) { rows = snapshot; name = oldName; catalogVersion = oldVersion; throw error; }
  });
  (prisma.product.findUnique as Mock).mockImplementation(async () => product() as any);
  (prisma.product.update as Mock).mockImplementation(async ({ data }: any) => {
    if (data.name) name = data.name;
    if (data.catalogVersion) catalogVersion += data.catalogVersion.increment;
    return product() as any;
  });
  (prisma.productVariants.findMany as Mock).mockImplementation(async () => rows.map((v) => ({ ...v })) as any);
  (prisma.productVariants.update as Mock).mockImplementation(async ({ where, data }: any) => {
    const target = rows.find((v) => v.id === where.id)!;
    applyData(target, data);
    return target as any;
  });
  (prisma.productVariants.create as Mock).mockImplementation(async ({ data }: any) => {
    const created = { unavailableStock: 0, inventoryVersion: 0, retiredAt: null, id: "new-" + rows.length, ...data };
    rows.push(created);
    return created;
  });
  (prisma.productVariants.updateMany as Mock).mockImplementation(async ({ where, data }: any) => {
    const targets = rows.filter((v) => where.id.in.includes(v.id));
    for (const v of targets) applyData(v, data);
    return { count: targets.length };
  });
  (prisma.productVariants.deleteMany as Mock).mockImplementation(async ({ where }: any) => {
    const before = rows.length;
    rows = rows.filter((v) =>
      !where.id.in.includes(v.id) ||
      (where.unavailableStock === 0 && v.unavailableStock !== 0) ||
      (where.cartItem?.none && v.carts) ||
      (where.orderItems?.none && v.orders)
    );
    return { count: before - rows.length };
  });
});

describe("Reconciliação transacional do serviço de produtos", () => {
  it("preserva ID e estoque ao renomear a combinação", async () => {
    await updateProduct("product", { variants: [{ id: "original", size: " 1L ", color: " Azul ", stock: 7 }] }, "store");
    expect(rows).toEqual([{ ...row("original", "1L", "Azul"), inventoryVersion: 1 }]);
    expect(prisma.productVariants.create).not.toHaveBeenCalled();
  });
  it("salva três vezes sem ID e mantém uma única variante", async () => {
    rows = [row("original", "Padrão")];
    for (let stock = 1; stock <= 3; stock++) {
      await updateProduct("product", { variants: [{ size: " unico ", color: "default", stock }] }, "store");
    }
    expect(rows).toEqual([{ ...row("original"), inventoryVersion: 1 }]);
    expect(prisma.productVariants.create).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(6);
  });
  it("cria apenas a combinação nova e mantém as anteriores", async () => {
    await updateProduct("product", { variants: [row("original"), { size: "1L", color: "Padrão", stock: 4 }] }, "store");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ ProductID: "product", size: "1L", stock: 0 });
    expect(prisma.productVariants.create).toHaveBeenCalledTimes(1);
  });
  it("remove opções sem vínculos e desativa opções com carrinhos ou pedidos", async () => {
    rows.push({ ...row("free", "500ml"), stock: 0 }, { ...row("cart", "1L"), carts: true }, { ...row("order", "5L"), orders: true });
    await updateProduct("product", { variants: [row("original")] }, "store");
    expect(rows.map((v) => v.id)).toEqual(["original", "cart", "order"]);
    expect(rows.filter((v) => v.id !== "original").map((v) => v.stock)).toEqual([0, 0]);
    expect(prisma.productVariants.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["free", "cart", "order"] }, cartItem: { none: {} }, orderItems: { none: {} }, reservations: { none: {} }, unavailableStock: 0 },
    });
  });
  it("retira duplicata antiga sem perder quantidade física nem somar ao estoque ativo", async () => {
    rows.push(row("duplicate"));
    await updateProduct("product", { variants: [{ size: "Único", color: "Padrão", stock: 2 }] }, "store");
    expect(rows[0]).toEqual(row("original"));
    expect(rows[1]).toMatchObject({ id: 'duplicate', stock: 0, unavailableStock: 10, retiredAt: expect.any(Date) });
  });
  it("rejeita um ID de outro produto e desfaz a alteração do produto", async () => {
    await expect(updateProduct("product", {
      name: "Alterado", variants: [{ ...row("foreign") }],
    }, "store")).rejects.toThrow("não pertence");
    expect(name).toBe("Produto");
    expect(rows).toEqual([row("original")]);
  });
  it("rejeita duplicatas no payload e desfaz a transação", async () => {
    await expect(updateProduct("product", {
      variants: [{ size: "Único", color: "Padrão", stock: 1 }, { size: "Padrão", color: "DEFAULT", stock: 2 }],
    }, "store")).rejects.toThrow("Não repita");
    expect(rows).toEqual([row("original")]);
  });
  it("rejeita IDs repetidos e remoção de todas as variantes", async () => {
    await expect(updateProduct("product", { variants: [row("original"), row("original", "1L")] }, "store"))
      .rejects.toThrow("ID da variante");
    await expect(updateProduct("product", { variants: [] }, "store")).rejects.toThrow("pelo menos uma");
    expect(rows).toEqual([row("original")]);
  });
  it("não toca nas variantes quando o campo é omitido", async () => {
    await updateProduct("product", { name: "Novo produto" }, "store");
    expect(name).toBe("Novo produto");
    expect(prisma.productVariants.findMany).not.toHaveBeenCalled();
    expect(prisma.productVariants.deleteMany).not.toHaveBeenCalled();
  });
  it("bloqueia edição por outra loja após releitura protegida", async () => {
    await expect(updateProduct("product", { variants: [row("original")] }, "other-store")).rejects.toThrow("PRODUCT_NOT_FOUND");
    expect(prisma.product.update).not.toHaveBeenCalled();
  });
  it("normaliza e impede duplicatas no cadastro", async () => {
    (prisma.loja.findUnique as Mock).mockResolvedValue({ id: "store" } as any);
    (prisma.product.create as Mock).mockImplementation(async ({ data }: any) => ({
      ...product(), productVariants: data.productVariants.create,
    }) as any);
    const input = {
      name: "Produto", description: "Descrição completa", price: 10, stock: 5,
      imageUrl: "https://example.com/p.png", lojaID: "store", userID: "admin",
      variants: [{ size: "PADRAO", color: "default", stock: 2 }],
    };
    const created = await createProduct(input);
    expect(created.productVariants).toMatchObject([{ size: "Único", color: "Padrão", stock: 2 }]);
    await expect(createProduct({ ...input, variants: [...input.variants, ...input.variants] })).rejects.toThrow("Não repita");
  });
});
