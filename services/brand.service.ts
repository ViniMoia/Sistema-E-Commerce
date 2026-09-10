import prisma from "@/lib/prisma";

export interface BrandWithCount {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  productCount: number;
}

export interface CategoryTagItem {
  id: string;
  name: string;
  slug: string;
  group: string;
  order: number;
  icon: string | null;
}

/**
 * Retorna todas as marcas ativas de uma loja com contagem de produtos associados.
 * Protegido contra vazamento multi-tenant (lojaID obrigatório).
 */
export async function getBrandsWithProductCount({
  lojaId,
}: {
  lojaId: string;
}): Promise<BrandWithCount[]> {
  const brands = await prisma.brand.findMany({
    where: {
      lojaID: lojaId,
      isActive: true,
    },
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    logoUrl: b.logoUrl,
    description: b.description,
    productCount: b._count.products,
  }));
}

/**
 * Retorna todas as etiquetas de categoria da loja ordenadas pela prioridade de exibição.
 */
export async function getCategoriesForLoja({
  lojaId,
}: {
  lojaId: string;
}): Promise<CategoryTagItem[]> {
  return await prisma.categoryTag.findMany({
    where: { lojaID: lojaId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      group: true,
      order: true,
      icon: true,
    },
  });
}
