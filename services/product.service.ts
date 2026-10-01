import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
            ? variants.map((v) => ({
                size: v.size,
                color: v.color,
                stock: Math.max(0, v.stock),
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
    const updateData: Prisma.ProductUpdateInput = {
      ...productData,
      ...(decimalPrice ? { price: decimalPrice } : {}),
    };

    const product = await tx.product.update({
      where: { id },
      data: updateData,
    });

    if (variants) {
      // Atualiza variantes existentes por ID quando fornecido, criando apenas as novas
      for (const v of variants) {
        const variantWithId = v as { id?: string; size: string; color: string; stock: number };
        if (variantWithId.id && existing.productVariants.some((ev) => ev.id === variantWithId.id)) {
          await tx.productVariants.update({
            where: { id: variantWithId.id },
            data: {
              size: variantWithId.size,
              color: variantWithId.color,
              stock: Math.max(0, variantWithId.stock),
            },
          });
        } else {
          await tx.productVariants.create({
            data: {
              ProductID: id,
              size: variantWithId.size,
              color: variantWithId.color,
              stock: Math.max(0, variantWithId.stock),
            },
          });
        }
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
