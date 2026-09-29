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
  sortBy?: "relevance" | "price_asc" | "price_desc" | "newest";
  /** Deslocamento interno; a API pública aceita page ou cursor. */
  offset?: number;
}

export interface ProductsPage<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  nextCursor: string | null;
}

function buildProductWhere(filters: GetProductsFilters): Prisma.ProductWhereInput {
  const { name, minPrice, maxPrice, lojaId, brandSlug, tags } = filters;
  return {
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
    id?: string;
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
  const { name, minPrice, maxPrice, lojaId, brandSlug, tags, page, limit, cursor, all, sortBy, offset } = filters;

  // Se all for true (usado pelo SSR interno da vitrine da loja), desativa o teto de paginação.
  // Caso contrário, impõe paginação protegida contra DoS (Finding SCL-001) com teto rígido de 100 itens.
  const take = all ? undefined : Math.min(Math.max(1, limit ? Number(limit) : 20), 100);
  const skip = all
    ? undefined
    : cursor
      ? 1
      : offset !== undefined
        ? Math.max(0, offset)
        : page
          ? (Math.max(1, Number(page)) - 1) * (take || 20)
          : 0;

  const where = buildProductWhere(filters);

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
    orderBy: getProductOrderBy(sortBy, Boolean(name)),
  });
}

function getProductOrderBy(
  sortBy: GetProductsFilters["sortBy"] = "newest",
  hasSearch = false
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sortBy) {
    case "price_asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "relevance":
      // Não há ranking full-text nesta stack. A ordem lexical é a
      // alternativa determinística para buscas até uma migração de contrato.
      return hasSearch
        ? [{ name: "asc" }, { id: "asc" }]
        : [{ createdAt: "desc" }, { id: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

/**
 * Retorna metadados para a API sem alterar o corpo legado (array) consumido
 * pelo frontend. O item sentinela prova a existência da próxima página.
 */
export async function getProductsPage(filters: GetProductsFilters = {}) {
  const pageSize = Math.min(Math.max(1, Number(filters.limit ?? 24)), 100);
  const page = Math.max(1, Number(filters.page ?? 1));
  const rows = await getProducts({
    ...filters,
    all: false,
    page,
    limit: pageSize + 1,
    offset: filters.cursor ? undefined : (page - 1) * pageSize,
  });
  const hasSentinel = rows.length > pageSize;
  const data = hasSentinel ? rows.slice(0, pageSize) : rows;

  const total = await prisma.product.count({ where: buildProductWhere(filters) });
  const hasNextPage = hasSentinel || (!filters.cursor && page * pageSize < total);

  return {
    data,
    total,
    page,
    pageSize,
    hasNextPage,
    nextCursor: hasNextPage ? data.at(-1)?.id ?? null : null,
  } satisfies ProductsPage<(typeof data)[number]>;
}

/**
 * Projeção limitada usada pela vitrine. Detalhes, galeria e relações que não
 * aparecem no card são carregados somente na rota dedicada do produto.
 */
export async function getCatalogProductsPage(filters: GetProductsFilters = {}) {
  const pageSize = Math.min(Math.max(1, Number(filters.limit ?? 12)), 100);
  const page = Math.max(1, Number(filters.page ?? 1));
  const where = buildProductWhere(filters);

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      take: pageSize + 1,
      skip: (page - 1) * pageSize || undefined,
      select: {
        id: true,
        lojaID: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        stock: true,
        tagsSearchCache: true,
        brand: { select: { name: true, slug: true } },
        productVariants: {
          select: { id: true, size: true, color: true, stock: true },
        },
      },
      orderBy: getProductOrderBy(filters.sortBy, Boolean(filters.name)),
    }),
    prisma.product.count({ where }),
  ]);

  const hasSentinel = rows.length > pageSize;
  const data = hasSentinel ? rows.slice(0, pageSize) : rows;
  const hasNextPage = hasSentinel || page * pageSize < total;

  return {
    data,
    total,
    page,
    pageSize,
    hasNextPage,
    nextCursor: hasNextPage ? data.at(-1)?.id ?? null : null,
  } satisfies ProductsPage<(typeof data)[number]>;
}

export async function countProductsForTenant(lojaId: string): Promise<number> {
  return prisma.product.count({ where: { lojaID: lojaId } });
}

export async function getProductById(id: string, lojaId?: string) {
  const product = await prisma.product.findFirst({
    where: {
      id,
      ...(lojaId ? { lojaID: lojaId } : {}),
    },
    include: {
      productVariants: true,
      brand: true,
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
        },
      },
    },
  });

  if (!product) {
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

    const normalizedVariants = variants.map((variant) => ({
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
    }));
    const aggregateStock = normalizedVariants.reduce((sum, variant) => sum + variant.stock, 0);

    const product = await tx.product.create({
      data: {
        ...productData,
        stock: aggregateStock,
        price: decimalPrice,
        productVariants: {
          create: normalizedVariants.length > 0
            ? normalizedVariants
            : [{
                size: "Único",
                color: "Padrão",
                stock: aggregateStock,
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
        entityId: product.id,
        newValue: {
          name: product.name,
          price: product.price.toString(),
          stock: product.stock,
          variantCount: product.productVariants.length,
        },
        metadata: { lojaID: productData.lojaID },
      },
    });

    return product;
  });
}

/**
 * Atualiza produto com validação rigorosa de posse de tenant (TEN-002).
 */
export async function updateProduct(
  id: string,
  data: UpdateProductInput,
  lojaId: string,
  actorId: string
) {
  const { variants, price, ...productData } = data;

  const decimalPrice = price !== undefined ? new Prisma.Decimal(price) : undefined;
  if (decimalPrice && decimalPrice.lessThan(0)) {
    throw new Error("O preço do produto não pode ser negativo");
  }

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { id },
      include: { productVariants: true },
    });
    if (!existing || existing.lojaID !== lojaId) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    if (variants === undefined && productData.stock !== undefined) {
      throw new Error("STOCK_MANAGED_BY_VARIANTS");
    }

    const variantUpdates: Array<{ id: string; size: string; color: string; stock: number }> = [];
    const variantCreates: Array<{ size: string; color: string; stock: number }> = [];
    let aggregateStock: number | undefined;

    if (variants) {
      const receivedIds = variants.flatMap((variant) => variant.id ? [variant.id] : []);
      if (new Set(receivedIds).size !== receivedIds.length) {
        throw new Error("DUPLICATE_VARIANT_ID");
      }

      const existingIds = new Set(existing.productVariants.map((variant) => variant.id));
      if (receivedIds.some((variantId) => !existingIds.has(variantId))) {
        throw new Error("VARIANT_NOT_FOUND");
      }
      if (existing.productVariants.some((variant) => !receivedIds.includes(variant.id))) {
        throw new Error("VARIANT_REMOVAL_REQUIRES_ARCHIVE");
      }

      for (const variant of variants) {
        const normalized = { size: variant.size, color: variant.color, stock: variant.stock };
        if (variant.id) variantUpdates.push({ id: variant.id, ...normalized });
        else variantCreates.push(normalized);
      }
      aggregateStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    }

    const updateData: Prisma.ProductUpdateInput = {
      ...productData,
      ...(aggregateStock !== undefined ? { stock: aggregateStock } : {}),
      ...(decimalPrice ? { price: decimalPrice } : {}),
    };

    const product = await tx.product.update({
      where: { id },
      data: updateData,
    });

    for (const variant of variantUpdates) {
      await tx.productVariants.update({
        where: { id: variant.id },
        data: { size: variant.size, color: variant.color, stock: variant.stock },
      });
    }
    if (variantCreates.length > 0) {
      await tx.productVariants.createMany({
        data: variantCreates.map((variant) => ({ ProductID: id, ...variant })),
      });
    }

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
          variants: existing.productVariants.map((variant) => ({
            id: variant.id, size: variant.size, color: variant.color, stock: variant.stock,
          })),
        },
        newValue: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(decimalPrice ? { price: decimalPrice.toString() } : {}),
          ...(aggregateStock !== undefined ? { stock: aggregateStock } : {}),
          ...(variants ? { variants } : {}),
        },
        metadata: { lojaID: lojaId },
      },
    });

    return tx.product.findUnique({
      where: { id },
      include: { productVariants: true },
    });
  });
}

/**
 * Remove produto com validação rigorosa de posse de tenant (TEN-002).
 */
export async function deleteProduct(id: string, lojaId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true, cartItem: true } } },
    });
    if (!existing || existing.lojaID !== lojaId) {
      throw new Error("PRODUCT_NOT_FOUND");
    }
    if (existing._count.orderItems > 0 || existing._count.cartItem > 0) {
      throw new Error("PRODUCT_IN_USE");
    }

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
        metadata: { lojaID: lojaId },
      },
    });

    return tx.product.delete({ where: { id } });
  });
}
