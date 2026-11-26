import { describe, it, expect } from 'vitest';
import { resolveHeroSlides } from '@/lib/hero/resolve-hero-slides';
import {
  DEFAULT_CONTINENTAL_HERO_SLIDES,
  heroSlidesArraySchema,
} from '@/lib/validators/hero-slides';
import type { FilterableProduct } from '@/hooks/useProductFilters';

describe('HeroCarousel Contract, Art Panels & Dual Price Suite', () => {
  const mockProducts: FilterableProduct[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Extratora e Aspirador IPC Lava Pro',
      price: 1899.0,
      pixPrice: 1709.1,
      isFeaturedHero: true,
      heroBannerUrl: 'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1/banner1.jpg',
      imageUrl: 'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1/img1.jpg',
      description: 'Extratora profissional para estofados',
      stock: 5,
      brandName: 'IPC',
      brandSlug: 'ipc',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Cera Carnaúba Vonixx Native 100ml',
      price: 149.9,
      pixPrice: 134.91,
      isFeaturedHero: false,
      heroBannerUrl: null,
      imageUrl: 'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1/img2.jpg',
      description: 'Cera premium artesanal',
      stock: 12,
      brandName: 'Vonixx',
      brandSlug: 'vonixx',
    },
  ];

  it('uses the 3 official Cloudinary art panels when store has no heroSlides and no featured products', () => {
    const productsNoFeatured = mockProducts.map((p) => ({ ...p, isFeaturedHero: false }));
    const slides = resolveHeroSlides(null, productsNoFeatured);

    expect(slides).toHaveLength(3);
    expect(slides[0].kind).toBe('ART_PANEL');
    expect(slides[0].desktopImageUrl).toBe(
      'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/3_hzfdbp.png'
    );
    expect(slides[1].desktopImageUrl).toBe(
      'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/4_fl1aqd.png'
    );
    expect(slides[2].desktopImageUrl).toBe(
      'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/2_grdpdk.jpg'
    );
    expect(slides.every((s) => s.product === null)).toBe(true);
  });

  it('falls back to featured products when Loja.heroSlides is empty and isFeaturedHero is true', () => {
    const slides = resolveHeroSlides([], mockProducts);
    expect(slides).toHaveLength(1);
    expect(slides[0].kind).toBe('PRODUCT_ART');
    expect(slides[0].overlayMode).toBe('MINIMAL_DOCK');
    expect(slides[0].product?.id).toBe(mockProducts[0].id);
    expect(slides[0].desktopImageUrl).toBe(mockProducts[0].heroBannerUrl);
  });

  it('prioritizes valid Loja.heroSlides and resolves authoritative product data from catalog', () => {
    const customSlides = [
      {
        id: 'panel-art',
        order: 0,
        active: true,
        kind: 'ART_PANEL' as const,
        desktopImageUrl: 'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/3_hzfdbp.png',
        altText: 'Painel Institucional Continental',
        overlayMode: 'NONE' as const,
        ctaLabel: 'Explorar Catálogo',
        anchorTarget: '#catalogo' as const,
      },
      {
        id: 'panel-product',
        order: 1,
        active: true,
        kind: 'PRODUCT_ART' as const,
        desktopImageUrl: 'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/4_fl1aqd.png',
        altText: 'Extratora IPC em destaque',
        productId: mockProducts[0].id,
        overlayMode: 'MINIMAL_DOCK' as const,
      },
      {
        id: 'panel-orphan-product',
        order: 2,
        active: true,
        kind: 'PRODUCT_ART' as const,
        desktopImageUrl: 'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1795660021/2_grdpdk.jpg',
        altText: 'Produto removido',
        productId: '99999999-9999-4999-8999-999999999999',
        overlayMode: 'MINIMAL_DOCK' as const,
      },
    ];

    const resolved = resolveHeroSlides(customSlides, mockProducts);
    expect(resolved).toHaveLength(2);
    expect(resolved[0].kind).toBe('ART_PANEL');
    expect(resolved[0].product).toBeNull();
    expect(resolved[1].kind).toBe('PRODUCT_ART');
    expect(resolved[1].product?.price).toBe(1899.0);
    expect(resolved[1].product?.pixPrice).toBe(1709.1);
  });

  it('rejects data:, blob: and invalid local paths in heroSlides schema', () => {
    const invalid = [
      {
        ...DEFAULT_CONTINENTAL_HERO_SLIDES[0],
        desktopImageUrl: 'data:image/png;base64,aW1hZ2U=',
      },
    ];
    expect(heroSlidesArraySchema.safeParse(invalid).success).toBe(false);

    const traversal = [
      {
        ...DEFAULT_CONTINENTAL_HERO_SLIDES[0],
        desktopImageUrl: '/hero/../secrets.png',
      },
    ];
    expect(heroSlidesArraySchema.safeParse(traversal).success).toBe(false);
  });
});
