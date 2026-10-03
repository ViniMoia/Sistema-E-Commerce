import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createProduct, updateProduct } from "@/services/product.service";

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

type Row = { id: string; ProductID: string; size: string; color: string; stock: number; carts?: boolean; orders?: boolean };
const row = (id: string, size = "Único", color = "Padrão"): Row =>
  ({ id, ProductID: "product", size, color, stock: 10 });
let rows: Row[];
let name: string;
const product = () => ({
  id: "product", lojaID: "store", name, price: new Prisma.Decimal(10), stock: 10,
  productVariants: rows.map((v) => ({ ...v })),
});

beforeEach(() => {
  vi.resetAllMocks();
  rows = [row("original")];
  name = "Produto";
  (prisma.$transaction as Mock).mockImplementation(async (callback: any) => {
    const snapshot = rows.map((v) => ({ ...v }));
    const oldName = name;
    try { return await callback(prisma); }
    catch (error) { rows = snapshot; name = oldName; throw error; }
  });
  (prisma.product.findUnique as Mock).mockImplementation(async () => product() as any);
  (prisma.product.update as Mock).mockImplementation(async ({ data }: any) => {
    if (data.name) name = data.name;
    return product() as any;
  });
  (prisma.productVariants.findMany as Mock).mockImplementation(async () => rows.map((v) => ({ ...v })) as any);
  (prisma.productVariants.update as Mock).mockImplementation(async ({ where, data }: any) => {
    const target = rows.find((v) => v.id === where.id)!;
    Object.assign(target, data);
    return target as any;
  });
  (prisma.productVariants.create as Mock).mockImplementation(async ({ data }: any) => {
    const created = { id: "new-" + rows.length, ...data };
    rows.push(created);
    return created;
  });
  (prisma.productVariants.updateMany as Mock).mockImplementation(async ({ where, data }: any) => {
    const targets = rows.filter((v) => where.id.in.includes(v.id));
    for (const v of targets) Object.assign(v, data);
    return { count: targets.length };
  });
  (prisma.productVariants.deleteMany as Mock).mockImplementation(async ({ where }: any) => {
    const before = rows.length;
    rows = rows.filter((v) =>
      !where.id.in.includes(v.id) ||
      (where.cartItem?.none && v.carts) ||
      (where.orderItems?.none && v.orders)
    );
    return { count: before - rows.length };
  });
});

describe("Reconciliação transacional do serviço de produtos", () => {
  it("preserva o ID ao renomear a combinação e atualizar o estoque", async () => {
    await updateProduct("product", { variants: [{ id: "original", size: " 1L ", color: " Azul ", stock: 7 }] }, "store");
    expect(rows).toEqual([{ ...row("original", "1L", "Azul"), stock: 7 }]);
    expect(prisma.productVariants.create).not.toHaveBeenCalled();
  });
  it("salva três vezes sem ID e mantém uma única variante", async () => {
    rows = [row("original", "Padrão")];
    for (let stock = 1; stock <= 3; stock++) {
      await updateProduct("product", { variants: [{ size: " unico ", color: "default", stock }] }, "store");
    }
    expect(rows).toEqual([{ ...row("original"), stock: 3 }]);
    expect(prisma.productVariants.create).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
  });
  it("cria apenas a combinação nova e mantém as anteriores", async () => {
    await updateProduct("product", { variants: [row("original"), { size: "1L", color: "Padrão", stock: 4 }] }, "store");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ ProductID: "product", size: "1L", stock: 4 });
    expect(prisma.productVariants.create).toHaveBeenCalledTimes(1);
  });
  it("remove opções sem vínculos e desativa opções com carrinhos ou pedidos", async () => {
    rows.push(row("free", "500ml"), { ...row("cart", "1L"), carts: true }, { ...row("order", "5L"), orders: true });
    await updateProduct("product", { variants: [row("original")] }, "store");
    expect(rows.map((v) => v.id)).toEqual(["original", "cart", "order"]);
    expect(rows.filter((v) => v.id !== "original").map((v) => v.stock)).toEqual([0, 0]);
    expect(prisma.productVariants.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["free", "cart", "order"] }, cartItem: { none: {} }, orderItems: { none: {} } },
    });
  });
  it("limpa duplicatas antigas sem vínculos ao reconciliar por combinação", async () => {
    rows.push(row("duplicate"));
    await updateProduct("product", { variants: [{ size: "Único", color: "Padrão", stock: 2 }] }, "store");
    expect(rows).toEqual([{ ...row("original"), stock: 2 }]);
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
  it("bloqueia a edição por outra loja antes da transação", async () => {
    await expect(updateProduct("product", { variants: [row("original")] }, "other-store")).rejects.toThrow("PRODUCT_NOT_FOUND");
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
