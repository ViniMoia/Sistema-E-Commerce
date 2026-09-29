import type { MetadataRoute } from "next";
import { getLojaFromHeaders, getTenantCanonicalOrigin } from "@/lib/tenant";
import { PRIVATE_WEB_PATHS } from "@/lib/web-seo";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const loja = await getLojaFromHeaders();
  const origin = loja ? getTenantCanonicalOrigin(loja) : null;

  if (!origin) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/produto/"],
      disallow: PRIVATE_WEB_PATHS,
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

