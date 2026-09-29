import type { MetadataRoute } from "next";
import { getLojaFromHeaders, getTenantCanonicalOrigin } from "@/lib/tenant";
import { getProducts } from "@/services/product.service";
import { productPath } from "@/lib/web-seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const loja = await getLojaFromHeaders();
  const origin = loja ? getTenantCanonicalOrigin(loja) : null;
  if (!loja || !origin) return [];

  const products = await getProducts({ lojaId: loja.id, all: true });
  return [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...products.map((product) => ({
      url: `${origin}${productPath(product.id)}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: toSitemapImages(product.imageUrl),
    })),
  ];
}

function toSitemapImages(imageUrl: string): string[] | undefined {
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === "https:" ? [parsed.toString()] : undefined;
  } catch {
    return undefined;
  }
}
