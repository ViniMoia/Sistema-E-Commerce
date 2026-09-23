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
      loja: true,
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

    return await tx.product.create({
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
  });
}

/**
 * Atualiza produto com validação rigorosa de posse de tenant (TEN-002).
 */
export async function updateProduct(id: string, data: UpdateProductInput, lojaId?: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
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
      await tx.productVariants.deleteMany({
        where: { ProductID: id },
      });

      await tx.productVariants.createMany({
        data: variants.map((v) => ({
          ProductID: id,
          size: v.size,
          color: v.color,
          stock: Math.max(0, v.stock),
        })),
      });
    }

    return tx.product.findUnique({
      where: { id },
      include: { productVariants: true },
    });
  });
}

/**
 * Remove produto com validação rigorosa de posse de tenant (TEN-002).
 */
export async function deleteProduct(id: string, lojaId?: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || (lojaId && existing.lojaID !== lojaId)) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  return await prisma.product.delete({
    where: { id },
  });
}
