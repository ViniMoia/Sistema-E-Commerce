import prisma from "@/lib/prisma";

export async function getProducts(filters: any = {}) {
  const { name, minPrice, maxPrice, lojaId, page, limit } = filters;

  const take = limit ? Number(limit) : undefined;
  const skip = page && limit ? (Number(page) - 1) * Number(limit) : undefined;

  return await prisma.product.findMany({
    where: {
      name: name ? { contains: name, mode: "insensitive" } : undefined,
      price: {
        gte: minPrice,
        lte: maxPrice,
      },
      lojaID: lojaId,
    },
    take,
    skip,
    include: {
      productVariants: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      productVariants: true,
      loja: true,
    },
  });

  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  return product;
}

export async function createProduct(data: any) {
  const { variants, ...productData } = data;

  return await prisma.$transaction(async (tx) => {
    const loja = await tx.loja.findUnique({ where: { id: productData.lojaID } });
    if (!loja) throw new Error("STORE_NOT_FOUND");

    return await tx.product.create({
      data: {
        ...productData,
        productVariants: {
          create: variants.map((v: any) => ({
            size: v.size,
            color: v.color,
            stock: v.stock,
          })),
        },
      },
      include: {
        productVariants: true,
      },
    });
  });
}

export async function updateProduct(id: string, data: any) {
  const { variants, ...productData } = data;

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id },
      data: productData,
    });

    if (variants) {
      await tx.productVariants.deleteMany({
        where: { ProductID: id },
      });

      await tx.productVariants.createMany({
        data: variants.map((v: any) => ({
          ProductID: id,
          size: v.size,
          color: v.color,
          stock: v.stock,
        })),
      });
    }

    return tx.product.findUnique({
      where: { id },
      include: { productVariants: true },
    });
  });
}

export async function deleteProduct(id: string) {
  return await prisma.product.delete({
    where: { id },
  });
}
