import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { canonicalizeVariant, getVariantCombinationKey, type VariantInput } from "@/lib/product-variants";

export class ProductVariantError extends Error {}

function prepareVariants(variants: VariantInput[]): VariantInput[] {
  const seen = new Set<string>();
  return variants.map((variant) => {
    if (!variant.size.trim() || !variant.color.trim() || !Number.isInteger(variant.stock)) {
      throw new ProductVariantError("Dados de variante inválidos.");
    }
    const normalized = canonicalizeVariant(variant);
    const key = getVariantCombinationKey(normalized);
    if (seen.has(key)) throw new ProductVariantError("Não repita a mesma combinação de tamanho e cor.");
    seen.add(key);
    return normalized;
  });
}


export interface GetProductsFilters {
  name?: string;
  minPrice?: number;
  maxPrice?: number;
  lojaId?: string;
  brandSlug?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  cursor?: string;
  all?: boolean;
}

export interface CreateProductInput {
  name: string;
  description: string;
  price: number | Prisma.Decimal;
  imageUrl: string;
  galleryUrls?: string[];
  stock: number;
  lojaID: string;
  userID: string;
  variants: Array<{
    size: string;
    color: string;
    stock: number;
  }>;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number | Prisma.Decimal;
  imageUrl?: string;
  galleryUrls?: string[];
  stock?: number;
  variants?: Array<{
    id?: string;
    size: string;
    color: string;
    stock: number;
  }>;
}

/**
 * Consulta produtos com paginação protegida contra DoS (Finding SCL-001).
 * Limite máximo rígido de 100 itens por página.
 */
export async function getProducts(filters: GetProductsFilters = {}) {
  const { name, minPrice, maxPrice, lojaId, brandSlug, tags, page, limit, cursor, all } = filters;

  // Se all for true (usado pelo SSR interno da vitrine da loja), desativa o teto de paginação.
  // Caso contrário, impõe paginação protegida contra DoS (Finding SCL-001) com teto rígido de 100 itens.
  const take = all ? undefined : Math.min(Math.max(1, limit ? Number(limit) : 20), 100);
  const skip = all ? undefined : cursor ? 1 : page ? (Math.max(1, Number(page)) - 1) * (take || 20) : 0;

  const where: Prisma.ProductWhereInput = {
    ...(name ? { name: { contains: name, mode: "insensitive" } } : {}),
    ...((minPrice !== undefined || maxPrice !== undefined)
      ? {
          price: {
            ...(minPrice !== undefined ? { gte: new Prisma.Decimal(minPrice) } : {}),
            ...(maxPrice !== undefined ? { lte: new Prisma.Decimal(maxPrice) } : {}),
          },
        }
      : {}),
    ...(lojaId ? { lojaID: lojaId } : {}),
    ...(brandSlug ? { brand: { slug: brandSlug } } : {}),
    ...(tags && tags.length > 0
      ? {
          OR: [
            { categoryTags: { some: { categoryTag: { slug: { in: tags } } } } },
            { tagsSearchCache: { hasSome: tags } },
          ],
        }
      : {}),
  };

  return await prisma.product.findMany({
    where,
    take,
    skip: skip > 0 ? skip : undefined,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      productVariants: true,
      brand: true,
      categoryTags: {
        include: {
          categoryTag: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getProductById(id: string, lojaId?: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      productVariants: true,
      loja: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          coverImageUrl: true,
          whatsappNumber: true,
          primaryColor: true,
          secondaryColor: true,
          pixKey: true,
          pixKeyType: true,
        },
      },
    },
  });

  if (!product || (lojaId && product.lojaID !== lojaId)) {
    throw new Error("PRODUCT_NOT_FOUND");
  }
  return product;
}

export async function createProduct(data: CreateProductInput) {
  const { variants, price, ...productData } = data;

  const decimalPrice = new Prisma.Decimal(price);
  if (decimalPrice.lessThan(0)) {
    throw new Error("O preço do produto não pode ser negativo");
  }

  return await prisma.$transaction(async (tx) => {
    const loja = await tx.loja.findUnique({ where: { id: productData.lojaID } });
    if (!loja) throw new Error("STORE_NOT_FOUND");

    const createdProduct = await tx.product.create({
      data: {
        ...productData,
        price: decimalPrice,
        productVariants: {
          create: variants && variants.length > 0
            ? prepareVariants(variants).map((v) => ({
                size: v.size,
                color: v.color,
                stock: v.stock,
              }))
            : [{
                size: "Único",
                color: "Padrão",
                stock: Math.max(0, productData.stock || 0),
              }],
        },
      },
      include: {
        productVariants: true,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "PRODUCT_CREATED",
        actorId: productData.userID,
        targetId: productData.userID,
        entity: "Product",
        entityId: createdProduct.id,
        newValue: {
          name: createdProduct.name,
          price: createdProduct.price.toString(),
          stock: createdProduct.stock,
          variantCount: createdProduct.productVariants.length,
        },
        metadata: { lojaID: productData.lojaID },
      },
    });

    return createdProduct;
  });
}

/**
 * Atualiza produto com validação rigorosa de posse de tenant (TEN-002) e preservação de integridade de variantes.
 */
export async function updateProduct(
  id: string,
  data: UpdateProductInput,
  lojaId?: string,
  actorId?: string
) {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: { productVariants: true },
  });
  if (!existing || (lojaId && existing.lojaID !== lojaId)) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const { variants, price, ...productData } = data;

  const decimalPrice = price !== undefined ? new Prisma.Decimal(price) : undefined;
  if (decimalPrice && decimalPrice.lessThan(0)) {
    throw new Error("O preço do produto não pode ser negativo");
  }

  return await prisma.$transaction(async (tx) => {
    if (variants !== undefined) {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${id} FOR UPDATE`;
    }

    const updateData: Prisma.ProductUpdateInput = {
      ...productData,
      ...(decimalPrice ? { price: decimalPrice } : {}),
    };

    const product = await tx.product.update({
      where: { id },
      data: updateData,
    });

    if (variants !== undefined) {
      if (variants.length === 0) throw new ProductVariantError("Adicione pelo menos uma variante.");
      const incoming = prepareVariants(variants);
      // O lock explícito acima serializa edições concorrentes. Leia as variantes
      // depois de adquirir esse lock, para não reconciliar um snapshot desatualizado.
      const existingVariants = await tx.productVariants.findMany({
        where: { ProductID: id },
        orderBy: { createdAt: "asc" },
      });
      const processedVariantIds = new Set<string>();
      for (const variant of incoming) {
        const target = variant.id
          ? existingVariants.find((ev) => ev.id === variant.id)
          : existingVariants.find((ev) =>
              !processedVariantIds.has(ev.id) &&
              getVariantCombinationKey(ev) === getVariantCombinationKey(variant)
            );
        if (variant.id && !target) {
          throw new ProductVariantError("A variante informada não pertence a este produto.");
        }
        if (target && processedVariantIds.has(target.id)) {
          throw new ProductVariantError("Não repita o ID da variante.");
        }
        const variantData = { size: variant.size, color: variant.color, stock: variant.stock };
        if (target) {
          await tx.productVariants.update({ where: { id: target.id }, data: variantData });
          processedVariantIds.add(target.id);
        } else {
          const created = await tx.productVariants.create({
            data: { ProductID: id, ...variantData },
          });
          processedVariantIds.add(created.id);
        }
      }

      const removedIds = existingVariants
        .filter((variant) => !processedVariantIds.has(variant.id))
        .map((variant) => variant.id);
      if (removedIds.length > 0) {
        // Desativa as opções removidas que ainda possuem vínculos.
        await tx.productVariants.updateMany({
          where: { id: { in: removedIds } },
          data: { stock: 0 },
        });
        await tx.productVariants.deleteMany({
          where: {
            id: { in: removedIds },
            cartItem: { none: {} },
            orderItems: { none: {} },
          },
        });
      }
    }

    if (actorId) {
      await tx.auditLog.create({
        data: {
          action: "PRODUCT_UPDATED",
          actorId,
          targetId: actorId,
          entity: "Product",
          entityId: id,
          previousValue: {
            name: existing.name,
            price: existing.price.toString(),
            stock: existing.stock,
          },
          newValue: {
            name: product.name,
            price: product.price.toString(),
            stock: product.stock,
          },
          metadata: { lojaID: existing.lojaID },
        },
      });
    }

    return tx.product.findUnique({
      where: { id },
      include: { productVariants: true },
    });
  });
}

/**
 * Remove produto com validação rigorosa de posse de tenant (TEN-002) e bloqueio se houver histórico de pedidos.
 */
export async function deleteProduct(id: string, lojaId?: string, actorId?: string) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orderItems: true, cartItem: true },
        },
      },
    });

    if (!existing || (lojaId && existing.lojaID !== lojaId)) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    if (existing._count.orderItems > 0 || existing._count.cartItem > 0) {
      throw new Error("PRODUCT_IN_USE");
    }

    if (actorId) {
      await tx.auditLog.create({
        data: {
          action: "PRODUCT_DELETED",
          actorId,
          targetId: actorId,
          entity: "Product",
          entityId: id,
          previousValue: {
            name: existing.name,
            price: existing.price.toString(),
            stock: existing.stock,
          },
          metadata: { lojaID: existing.lojaID },
        },
      });
    }

    return await tx.product.delete({
      where: { id },
    });
  });
}
