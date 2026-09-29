import React from "react";
import { getLojaFromHeaders } from "@/lib/tenant";
import {
  countProductsForTenant,
  getCatalogProductsPage,
} from "@/services/product.service";
import { getBrandsWithProductCount } from "@/services/brand.service";
import HomeClient from "@/components/home/HomeClient";
import { notFound } from "next/navigation";
import { getTenantCanonicalOrigin } from "@/lib/tenant";
import { serializeJsonLd, toAbsoluteHttpUrl } from "@/lib/web-seo";
import {
  catalogStateToProductFilters,
  parseCatalogSearchParams,
  searchParamsToUrlSearchParams,
} from "@/lib/catalog-query";

const CATALOG_PAGE_SIZE = 12;

export default async function EcommerceHomepage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const activeLoja = await getLojaFromHeaders();
  if (!activeLoja) {
    notFound();
  }

  const catalogFilters = parseCatalogSearchParams(
    searchParamsToUrlSearchParams(await searchParams)
  );
  const productFilters = catalogStateToProductFilters(
    catalogFilters,
    activeLoja.id,
    CATALOG_PAGE_SIZE
  );

  const [catalogPage, brands, totalProducts] = await Promise.all([
    getCatalogProductsPage(productFilters),
    getBrandsWithProductCount({ lojaId: activeLoja.id }),
    countProductsForTenant(activeLoja.id),
  ]);

  const formattedProducts = catalogPage.data.map((prod) => ({
    id: prod.id,
    lojaID: prod.lojaID,
    name: prod.name,
    price: Number(prod.price),
    description: prod.description,
    imageUrl: prod.imageUrl,
    stock: prod.stock,
    galleryUrls: [],
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

  const canonicalOrigin = getTenantCanonicalOrigin(activeLoja);
  const storeJsonLd = canonicalOrigin
    ? {
        "@context": "https://schema.org",
        "@type": "OnlineStore",
        name: activeLoja.name,
        url: canonicalOrigin,
        description: activeLoja.description,
        image: toAbsoluteHttpUrl(activeLoja.coverImageUrl, canonicalOrigin) || undefined,
      }
    : null;

  return (
    <>
      {storeJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(storeJsonLd) }}
        />
      )}
      <HomeClient
        initialProducts={formattedProducts}
        initialBrands={brands}
        lojaInfo={lojaInfo}
        initialCatalogFilters={catalogFilters}
        catalogPagination={{
          totalCount: totalProducts,
          filteredCount: catalogPage.total,
          currentPage: catalogPage.page,
          pageSize: catalogPage.pageSize,
        }}
      />
    </>
  );
}
