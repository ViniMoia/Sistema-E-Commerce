import React from "react";
import { getLojaFromHeaders } from "@/lib/tenant";
import { getProducts } from "@/services/product.service";
import { getBrandsWithProductCount } from "@/services/brand.service";
import HomeClient from "@/components/home/HomeClient";
import { notFound } from "next/navigation";

export default async function EcommerceHomepage() {
  const activeLoja = await getLojaFromHeaders();
  if (!activeLoja) {
    notFound();
  }

  // Fetch store products and brands on the server side
  const [products, brands] = await Promise.all([
    getProducts({ lojaId: activeLoja.id, all: true }),
    getBrandsWithProductCount({ lojaId: activeLoja.id }),
  ]);

  // Map to serializable format for the client component
  const formattedProducts = products.map((prod) => ({
    id: prod.id,
    name: prod.name,
    price: Number(prod.price),
    description: prod.description,
    imageUrl: prod.imageUrl,
    stock: prod.stock,
    galleryUrls: prod.galleryUrls,
    brandName: prod.brand?.name || null,
    brandSlug: prod.brand?.slug || null,
    tags: prod.tagsSearchCache || [],
    productVariants: prod.productVariants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      stock: v.stock,
    })),
  }));

  const lojaInfo = {
    name: activeLoja.name,
    description: activeLoja.description,
    coverImageUrl: activeLoja.coverImageUrl,
    whatsappNumber: activeLoja.whatsappNumber,
  };

  return (
    <HomeClient
      initialProducts={formattedProducts}
      initialBrands={brands}
      lojaInfo={lojaInfo}
    />
  );
}
