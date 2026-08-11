import React from "react";
import { getLojaFromHeaders } from "@/lib/tenant";
import { getProducts } from "@/services/product.service";
import HomeClient from "@/components/home/HomeClient";
import { notFound } from "next/navigation";

export default async function EcommerceHomepage() {
  const activeLoja = await getLojaFromHeaders();
  if (!activeLoja) {
    notFound();
  }

  // Fetch store products on the server side
  const products = await getProducts({ lojaId: activeLoja.id });

  // Map to serializable format for the client component
  const formattedProducts = products.map((prod) => ({
    id: prod.id,
    name: prod.name,
    price: prod.price,
    description: prod.description,
    imageUrl: prod.imageUrl,
    stock: prod.stock,
    galleryUrls: prod.galleryUrls,
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

  return <HomeClient initialProducts={formattedProducts} lojaInfo={lojaInfo} />;
}
