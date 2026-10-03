import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { loadEnvConfig } from "@next/env";
import { updateProductSchema } from "@/lib/validators/product";
import { resolveCatalogVariant } from "@/lib/product-variants";

// Opt-in: este teste salva apenas os mesmos dados do produto do incidente.
// Não utiliza o seed/reset das suites de integração de bancos descartáveis.
describe.skipIf(process.env.VERIFY_VARIANT_DATABASE !== "1")("Verificação do workflow no banco configurado", () => {
  let prisma: typeof import("@/lib/prisma").default;
  let updateProduct: typeof import("@/services/product.service").updateProduct;
  let original: any;
  let payload: any;
  const productId = "6a6e98eb-98c3-4ba2-aede-a357d43893cf";
  const variantId = "eed23950-87e7-41b8-927a-6c5f2c75f026";

  beforeAll(async () => {
    loadEnvConfig(process.cwd());
    prisma = (await import("@/lib/prisma")).default;
    updateProduct = (await import("@/services/product.service")).updateProduct;
    original = await prisma.product.findUnique({ where: { id: productId }, include: { productVariants: true } });
    if (!original || original.productVariants.length !== 1 || original.productVariants[0].id !== variantId) {
      throw new Error("O saneamento precisa estar concluído antes desta verificação.");
    }
    payload = {
      name: original.name, description: original.description, price: Number(original.price),
      imageUrl: original.imageUrl, galleryUrls: original.galleryUrls, stock: original.stock,
      variants: original.productVariants.map((v: any) => ({
        id: v.id, size: v.size, color: v.color, stock: v.stock,
      })),
    };
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it("preserva o ID em três salvamentos consecutivos do payload do Admin", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const saved = await updateProduct(productId, updateProductSchema.parse(payload), original.lojaID, original.userID);
      expect(saved.productVariants).toHaveLength(1);
      expect(saved.productVariants[0]).toMatchObject({ id: variantId, size: "Único", color: "Padrão" });
      expect(saved.stock).toBe(original.stock);
      expect(saved.galleryUrls).toEqual(original.galleryUrls);
    }
  });
  it("também permanece único após três salvamentos de um cliente sem ID", async () => {
    const withoutId = { ...payload, variants: payload.variants.map(({ id: _id, ...v }: any) => v) };
    for (let attempt = 0; attempt < 3; attempt++) {
      const saved = await updateProduct(productId, updateProductSchema.parse(withoutId), original.lojaID, original.userID);
      expect(saved.productVariants).toHaveLength(1);
      expect(resolveCatalogVariant(saved.productVariants)?.id).toBe(variantId);
    }
    const products = await prisma.product.findMany({ select: { productVariants: { select: { size: true, color: true } } } });
    const key = (v: any) => JSON.stringify([v.size.trim().toLowerCase(), v.color.trim().toLowerCase()]);
    expect(products.filter((p) => new Set(p.productVariants.map(key)).size !== p.productVariants.length)).toHaveLength(0);
  });
});
