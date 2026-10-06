import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { canonicalizeVariant, getVariantCombinationKey, type VariantInput } from "@/lib/product-variants";
import { CommerceLocks } from '@/lib/commerce/locks';

export class ProductVariantError extends Error {}
export class ProductConflictError extends Error {}

function prepareVariants(variants: VariantInput[]): VariantInput[] {
  const seen = new Set<string>();
  return variants.map((variant) => {
    if (!variant.size.trim() || !variant.color.trim() || !Number.isInteger(variant.stock) || variant.stock < 0 || variant.stock > 2147483647) {
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
  expectedCatalogVersion?: number;
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
    retiredAt: null,
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
      productVariants: { where: { retiredAt: null } },
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
  if (!Number.isInteger(productData.stock) || productData.stock < 0 || productData.stock > 2147483647) throw new ProductVariantError('Estoque inicial inválido.');
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
                stock: productData.stock,
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
  // Stock in old full-form payloads is intentionally not a stock command.
  const { variants, price } = data;

  const decimalPrice = price !== undefined ? new Prisma.Decimal(price) : undefined;
  if (decimalPrice && decimalPrice.lessThan(0)) {
    throw new Error("O preço do produto não pode ser negativo");
  }

  return await prisma.$transaction(async (tx) => {
    const locks = new CommerceLocks(tx);
    await locks.acquire('product', [id]);
    const existing = await tx.product.findUnique({ where: { id }, include: { productVariants: true } });
    if (!existing || (lojaId && existing.lojaID !== lojaId)) throw new Error('PRODUCT_NOT_FOUND');
    if (data.expectedCatalogVersion !== undefined && data.expectedCatalogVersion !== existing.catalogVersion) throw new ProductConflictError('CATALOG_VERSION_CONFLICT');
    if (variants !== undefined && data.expectedCatalogVersion === undefined) throw new ProductConflictError('CATALOG_VERSION_REQUIRED');

    const updateData: Prisma.ProductUpdateInput = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      ...(data.galleryUrls !== undefined ? { galleryUrls: data.galleryUrls } : {}),
      catalogVersion: { increment: 1 },
      ...(variants !== undefined ? { inventoryVersion: { increment: 1 } } : {}),
      ...(decimalPrice ? { price: decimalPrice } : {}),
    };

    const product = await tx.product.update({
      where: { id },
      data: updateData,
    });
    const withdrawals: Array<{ variantId: string; availableBefore: number; unavailableBefore: number; unavailableAfter: number }> = [];

    if (variants !== undefined) {
      if (variants.length === 0) throw new ProductVariantError("Adicione pelo menos uma variante.");
      const incoming = prepareVariants(variants);
      // O lock explícito acima serializa edições concorrentes. Leia as variantes
      // depois de adquirir esse lock, para não reconciliar um snapshot desatualizado.
      const existingVariants = await tx.productVariants.findMany({
        where: { ProductID: id },
        orderBy: { createdAt: "asc" },
      });
      await locks.acquire('variant', existingVariants.map(variant => variant.id));
      const processedVariantIds = new Set<string>();
      for (const variant of incoming) {
        const target = variant.id
          ? existingVariants.find((ev) => ev.id === variant.id)
          : existingVariants.find((ev) =>
              !ev.retiredAt &&
              !processedVariantIds.has(ev.id) &&
              getVariantCombinationKey(ev) === getVariantCombinationKey(variant)
            );
        if (variant.id && !target) {
          throw new ProductVariantError("A variante informada não pertence a este produto.");
        }
        if (target && processedVariantIds.has(target.id)) {
          throw new ProductVariantError("Não repita o ID da variante.");
        }
        if (target?.retiredAt) throw new ProductConflictError('VARIANT_REACTIVATION_REQUIRED');
        if ((!target || getVariantCombinationKey(target) !== getVariantCombinationKey(variant)) && existingVariants.some(ev => ev.retiredAt && ev.id !== target?.id && getVariantCombinationKey(ev) === getVariantCombinationKey(variant))) throw new ProductConflictError('VARIANT_COMBINATION_RETIRED');
        const variantData = { size: variant.size, color: variant.color };
        if (target) {
          await tx.productVariants.update({ where: { id: target.id }, data: { ...variantData,
            ...(target.size !== variantData.size || target.color !== variantData.color ? { inventoryVersion: { increment: 1 } } : {}),
          } });
          processedVariantIds.add(target.id);
        } else {
          const created = await tx.productVariants.create({
            data: { ProductID: id, ...variantData, stock: 0 },
          });
          processedVariantIds.add(created.id);
        }
      }

      const removedIds = existingVariants
        .filter((variant) => !processedVariantIds.has(variant.id))
        .map((variant) => variant.id);
      if (removedIds.length > 0) {
        // Withdrawal preserves quantities separately from sale availability.
        for (const removed of existingVariants.filter(variant => removedIds.includes(variant.id) && !variant.retiredAt)) {
          withdrawals.push({ variantId: removed.id, availableBefore: removed.stock, unavailableBefore: removed.unavailableStock, unavailableAfter: removed.unavailableStock + removed.stock });
          await tx.productVariants.update({ where: { id: removed.id }, data: {
            retiredAt: new Date(), stock: 0, unavailableStock: { increment: removed.stock }, inventoryVersion: { increment: 1 },
          } });
        }
        await tx.productVariants.deleteMany({
          where: {
            id: { in: removedIds },
            cartItem: { none: {} },
            orderItems: { none: {} },
            reservations: { none: {} },
            unavailableStock: 0,
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
          metadata: { lojaID: existing.lojaID, withdrawals, catalogVersion: product.catalogVersion },
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
    await new CommerceLocks(tx).acquire('product', [id]);
    const existing = await tx.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orderItems: true, cartItem: true, reservations: true },
        },
      },
    });

    if (!existing || (lojaId && existing.lojaID !== lojaId)) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    if (existing._count.orderItems > 0 || existing._count.cartItem > 0 || existing._count.reservations > 0) {
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
