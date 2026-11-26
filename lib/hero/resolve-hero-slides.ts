import type { FilterableProduct } from "@/hooks/useProductFilters";
import {
  DEFAULT_CONTINENTAL_HERO_SLIDES,
  heroSlidesArraySchema,
  type HeroOverlayMode,
  type HeroSlideConfig,
  type HeroSlideKind,
} from "@/lib/validators/hero-slides";

export interface ResolvedHeroSlide {
  id: string;
  kind: HeroSlideKind;
  desktopImageUrl: string;
  mobileImageUrl: string | null;
  altText: string;
  overlayMode: HeroOverlayMode;
  ctaLabel: string | null;
  anchorTarget: "#catalogo" | "#apresentacao" | "#localizacao";
  brandSlug: string | null;
  tagSlug: string | null;
  product: FilterableProduct | null;
}

function mapConfigToResolved(
  slide: HeroSlideConfig,
  productMap: Map<string, FilterableProduct>
): ResolvedHeroSlide | null {
  if (!slide.active) return null;

  if (slide.kind === "PRODUCT_ART") {
    const product = slide.productId ? productMap.get(slide.productId) ?? null : null;
    if (!product) {
      // Produto aposentado/removido ou não pertencente ao tenant: suprime slide órfão
      return null;
    }

    return {
      id: slide.id,
      kind: "PRODUCT_ART",
      desktopImageUrl: slide.desktopImageUrl,
      mobileImageUrl: slide.mobileImageUrl ?? null,
      altText: slide.altText || product.name,
      overlayMode: slide.overlayMode,
      ctaLabel: slide.ctaLabel ?? null,
      anchorTarget: slide.anchorTarget ?? "#catalogo",
      brandSlug: slide.brandSlug ?? product.brandSlug ?? null,
      tagSlug: slide.tagSlug ?? null,
      product,
    };
  }

  return {
    id: slide.id,
    kind: slide.kind,
    desktopImageUrl: slide.desktopImageUrl,
    mobileImageUrl: slide.mobileImageUrl ?? null,
    altText: slide.altText,
    overlayMode: slide.overlayMode === "MINIMAL_DOCK" && slide.kind === "BRAND_COLLECTION" ? "MINIMAL_DOCK" : "NONE",
    ctaLabel: slide.ctaLabel ?? null,
    anchorTarget: slide.anchorTarget ?? "#catalogo",
    brandSlug: slide.brandSlug ?? null,
    tagSlug: slide.tagSlug ?? null,
    product: null,
  };
}

/**
 * Resolve os painéis da Hero no servidor usando dados autoritativos do catálogo.
 * Ordem de prioridade:
 * 1. Loja.heroSlides válidos e ativos
 * 2. Produtos com isFeaturedHero === true (e preferencialmente heroBannerUrl)
 * 3. Painéis oficiais padrão da Continental (DEFAULT_CONTINENTAL_HERO_SLIDES)
 */
export function resolveHeroSlides(
  rawHeroSlides: unknown,
  products: FilterableProduct[]
): ResolvedHeroSlide[] {
  const productMap = new Map<string, FilterableProduct>();
  for (const product of products) {
    productMap.set(product.id, product);
  }

  // 1. Painéis configurados na loja (Loja.heroSlides)
  if (Array.isArray(rawHeroSlides) && rawHeroSlides.length > 0) {
    const parsed = heroSlidesArraySchema.safeParse(rawHeroSlides);
    if (parsed.success) {
      const resolved = [...parsed.data]
        .sort((a, b) => a.order - b.order)
        .map((slide) => mapConfigToResolved(slide, productMap))
        .filter((item): item is ResolvedHeroSlide => item !== null);

      if (resolved.length > 0) {
        return resolved;
      }
    } else {
      console.warn("[HERO_SLIDES_INVALID_CONFIG]", parsed.error.flatten());
    }
  }

  // 2. Produtos marcados como destaque na Hero (Product.isFeaturedHero)
  const featuredProducts = products.filter((p) => p.isFeaturedHero);
  if (featuredProducts.length > 0) {
    return featuredProducts.slice(0, 6).map((product) => ({
      id: `featured-product-${product.id}`,
      kind: "PRODUCT_ART",
      desktopImageUrl: product.heroBannerUrl || product.imageUrl,
      mobileImageUrl: null,
      altText: product.name,
      overlayMode: "MINIMAL_DOCK",
      ctaLabel: "Comprar Agora",
      anchorTarget: "#catalogo",
      brandSlug: product.brandSlug ?? null,
      tagSlug: null,
      product,
    }));
  }

  // 3. Fallback padrão com os painéis oficiais da Continental
  return DEFAULT_CONTINENTAL_HERO_SLIDES.map((slide) => ({
    id: slide.id,
    kind: slide.kind,
    desktopImageUrl: slide.desktopImageUrl,
    mobileImageUrl: slide.mobileImageUrl ?? null,
    altText: slide.altText,
    overlayMode: slide.overlayMode,
    ctaLabel: slide.ctaLabel ?? null,
    anchorTarget: slide.anchorTarget ?? "#catalogo",
    brandSlug: slide.brandSlug ?? null,
    tagSlug: slide.tagSlug ?? null,
    product: null,
  }));
}
