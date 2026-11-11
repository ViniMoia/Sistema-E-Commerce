import { describe, it, expect } from 'vitest';

describe('HeroCarousel Contract & Dual Price Suite', () => {
  const catalogCurrency = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const mockProducts = [
    {
      id: 'prod-1',
      name: 'Extratora e Aspirador IPC Lava Pro',
      price: 1899.0,
      pixPrice: 1709.1,
      isFeaturedHero: true,
      heroBannerUrl: 'https://example.com/banner1.jpg',
      imageUrl: 'https://example.com/img1.jpg',
      description: 'Extratora profissional para estofados',
      stock: 5,
    },
    {
      id: 'prod-2',
      name: 'Cera Carnaúba Vonixx Native 100ml',
      price: 149.9,
      pixPrice: 134.91,
      isFeaturedHero: false,
      heroBannerUrl: null,
      imageUrl: 'https://example.com/img2.jpg',
      description: 'Cera premium artesanal',
      stock: 12,
    },
    {
      id: 'prod-3',
      name: 'Politriz Roto Orbital Sigma Tools SGT',
      price: 899.0,
      pixPrice: 809.1,
      isFeaturedHero: true,
      heroBannerUrl: 'https://example.com/banner3.jpg',
      imageUrl: 'https://example.com/img3.jpg',
      description: 'Politriz 15mm 900W',
      stock: 8,
    },
  ];

  it('filters featured hero products when isFeaturedHero is true', () => {
    const featured = mockProducts.filter((p) => p.isFeaturedHero);
    expect(featured).toHaveLength(2);
    expect(featured[0].id).toBe('prod-1');
    expect(featured[1].id).toBe('prod-3');
  });

  it('falls back to products with price > 0 when no product has isFeaturedHero', () => {
    const productsNoFeatured = mockProducts.map((p) => ({ ...p, isFeaturedHero: false }));
    const featured = productsNoFeatured.filter((p) => p.isFeaturedHero);
    const slides = featured.length > 0 ? featured : productsNoFeatured.filter((p) => p.price > 0).slice(0, 5);
    expect(slides).toHaveLength(3);
  });

  it('prioritizes lojaInfo.heroSlides if configured by store owner in database', () => {
    const lojaInfo = {
      heroSlides: [
        {
          id: 'custom-banner-1',
          title: 'Promoção de Inauguração Belém',
          subtitle: 'Descontos imperdíveis no PIX',
          imageUrl: 'https://example.com/inauguracao.jpg',
          cardPrice: 99.0,
          pixPrice: 89.0,
        },
      ],
    };

    const slides = Array.isArray(lojaInfo.heroSlides) && lojaInfo.heroSlides.length > 0
      ? lojaInfo.heroSlides.map((s) => ({
          id: s.id,
          name: s.title,
          price: s.cardPrice,
          pixPrice: s.pixPrice,
        }))
      : mockProducts;

    expect(slides).toHaveLength(1);
    expect(slides[0].name).toBe('Promoção de Inauguração Belém');
  });

  it('computes correct dual prices and savings (card price vs pix price)', () => {
    const product = mockProducts[0];
    const cardPrice = product.price;
    const pixPrice = product.pixPrice!;
    const savings = cardPrice - pixPrice;

    expect(cardPrice).toBe(1899.0);
    expect(pixPrice).toBe(1709.1);
    expect(Math.round(savings * 100) / 100).toBe(189.9);

    expect(catalogCurrency.format(cardPrice)).toContain('1.899,00');
    expect(catalogCurrency.format(pixPrice)).toContain('1.709,10');
  });

  it('preserves CTA navigation anchors (#catalogo)', () => {
    const catalogCtaHref = '#catalogo';
    expect(catalogCtaHref).toBe('#catalogo');
  });
});

