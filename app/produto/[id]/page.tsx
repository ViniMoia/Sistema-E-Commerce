import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeClient from "@/components/home/HomeClient";
import { getLojaFromHeaders, getTenantCanonicalOrigin } from "@/lib/tenant";
import { productPath, serializeJsonLd, toAbsoluteHttpUrl } from "@/lib/web-seo";
import { getProductById } from "@/services/product.service";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

async function loadProduct(id: string) {
  const loja = await getLojaFromHeaders();
  if (!loja) return null;

  try {
    const product = await getProductById(id, loja.id);
    return { loja, product };
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") return null;
    throw error;
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await loadProduct(id);
  if (!result) return { title: "Produto não encontrado", robots: { index: false, follow: false } };

  const { loja, product } = result;
  const origin = getTenantCanonicalOrigin(loja);
  const path = productPath(product.id);
  const description = product.description.slice(0, 160);
  const image = origin ? toAbsoluteHttpUrl(product.imageUrl, origin) : null;

  return {
    title: `${product.name} | ${loja.name}`,
    description,
    alternates: origin ? { canonical: path } : undefined,
    robots: origin ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: origin
      ? {
          type: "website",
          locale: "pt_BR",
          siteName: loja.name,
          title: product.name,
          description,
          url: path,
          images: image ? [{ url: image, alt: product.name }] : undefined,
        }
      : undefined,
    twitter: origin
      ? {
          card: "summary_large_image",
          title: product.name,
          description,
          images: image ? [image] : undefined,
        }
      : undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const result = await loadProduct(id);
  if (!result) notFound();

  const { loja, product } = result;
  const origin = getTenantCanonicalOrigin(loja);
  const image = origin ? toAbsoluteHttpUrl(product.imageUrl, origin) : null;
  const formattedProduct = {
    id: product.id,
    lojaID: product.lojaID,
    name: product.name,
    price: Number(product.price),
    description: product.description,
    imageUrl: product.imageUrl,
    stock: product.stock,
    galleryUrls: product.galleryUrls,
    brandName: product.brand?.name || null,
    brandSlug: product.brand?.slug || null,
    tags: product.tagsSearchCache,
    productVariants: product.productVariants.map((variant) => ({
      id: variant.id,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
    })),
  };
  const productJsonLd = origin
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: image ? [image] : undefined,
        sku: product.sku || product.id,
        brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
        offers: {
          "@type": "Offer",
          url: `${origin}${productPath(product.id)}`,
          priceCurrency: "BRL",
          price: product.price.toString(),
          availability:
            product.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
        },
      }
    : null;

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
        />
      )}
      <HomeClient
        initialProducts={[formattedProduct]}
        lojaInfo={{
          name: loja.name,
          description: loja.description,
          coverImageUrl: loja.coverImageUrl,
          whatsappNumber: loja.whatsappNumber,
        }}
        initialSelectedProductId={product.id}
        dedicatedProductPage
      />
    </>
  );
}
