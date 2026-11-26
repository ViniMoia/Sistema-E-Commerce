'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Pause,
  Play,
} from 'lucide-react';
import type { FilterableProduct } from '@/hooks/useProductFilters';
import {
  resolveHeroSlides,
  type ResolvedHeroSlide,
} from '@/lib/hero/resolve-hero-slides';

export interface HeroCatalogFilterTarget {
  brandSlug?: string | null;
  tagSlug?: string | null;
}

interface HeroCarouselProps {
  slides?: ResolvedHeroSlide[];
  products?: FilterableProduct[];
  lojaInfo?: {
    name?: string;
    description?: string;
    whatsappNumber?: string | null;
    heroSlides?: unknown;
  } | null;
  onSelectProduct?: (product: FilterableProduct) => void;
  onBuyProduct?: (product: FilterableProduct) => void;
  onFilterCatalog?: (filter: HeroCatalogFilterTarget) => void;
}

export default function HeroCarousel({
  slides: preResolvedSlides,
  products = [],
  lojaInfo,
  onSelectProduct,
  onBuyProduct,
  onFilterCatalog,
}: HeroCarouselProps) {
  const slides = useMemo<ResolvedHeroSlide[]>(() => {
    if (preResolvedSlides && preResolvedSlides.length > 0) {
      return preResolvedSlides;
    }
    return resolveHeroSlides(lojaInfo?.heroSlides ?? null, products);
  }, [preResolvedSlides, lojaInfo?.heroSlides, products]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const safeIndex = slides.length > 0 ? currentIndex % slides.length : 0;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(media.matches);
    const onChange = () => setPrefersReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // Auto-play (6 segundos), desligado quando pausado ou com reduced-motion ativo
  useEffect(() => {
    if (slides.length <= 1 || isPaused || prefersReducedMotion) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [slides.length, isPaused, prefersReducedMotion]);

  // Mantém contrato com ConditionalHeader para revelar o topo imediatamente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hero-car-illuminated'));
    }
  }, []);

  const goToNext = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const goToPrev = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const scrollToAnchor = useCallback(
    (anchor: '#catalogo' | '#apresentacao' | '#localizacao' = '#catalogo') => {
      if (typeof document === 'undefined') return;
      const targetId = anchor.replace('#', '');
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({
          behavior: prefersReducedMotion ? 'instant' : 'smooth',
        });
      }
    },
    [prefersReducedMotion]
  );

  const handleSlideAction = useCallback(
    (slide: ResolvedHeroSlide) => {
      if (slide.kind === 'PRODUCT_ART' && slide.product) {
        onSelectProduct?.(slide.product);
        return;
      }

      if (
        slide.kind === 'BRAND_COLLECTION' &&
        (slide.brandSlug || slide.tagSlug)
      ) {
        onFilterCatalog?.({
          brandSlug: slide.brandSlug,
          tagSlug: slide.tagSlug,
        });
        scrollToAnchor('#catalogo');
        return;
      }

      scrollToAnchor(slide.anchorTarget || '#catalogo');
    },
    [onSelectProduct, onFilterCatalog, scrollToAnchor]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPrev();
    }
  };

  if (slides.length === 0) {
    return (
      <section className="relative w-full pt-16 md:pt-20 bg-black text-white border-b border-catalog-gold/15">
        <div className="max-w-[1680px] mx-auto px-6 py-20 sm:py-28 flex flex-col items-center justify-center text-center space-y-5">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold tracking-widest text-[#F0B40E] bg-[#F0B40E]/10 border border-[#F0B40E]/30 uppercase">
            <Sparkles className="w-3.5 h-3.5 text-[#F0B40E]" />
            Estética Automotiva de Precisão
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight uppercase">
            {lojaInfo?.name || 'CONTINENTAL AUTOMOTIVA'}
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
            Produtos profissionais para proteção, polimento e estética automotiva de alto rendimento.
          </p>
          <a
            href="#catalogo"
            onClick={(e) => {
              e.preventDefault();
              scrollToAnchor('#catalogo');
            }}
            className="btn-shimmer inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(240,180,14,0.35)] hover:brightness-110 transition-all cursor-pointer"
          >
            Explorar Catálogo <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative w-full pt-16 md:pt-20 bg-black text-white select-none border-b border-catalog-gold/15"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (diff > 50) goToNext();
        else if (diff < -50) goToPrev();
        touchStartX.current = null;
      }}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Painéis de Produtos e Marcas em Destaque"
      role="region"
    >
      {/* Container Principal: 3 Colunas (Seta Esquerda ~2.5% | Palco 95% | Seta Direita ~2.5%) */}
      <div className="relative w-full max-w-[1920px] mx-auto px-1 sm:px-2 md:px-3 flex items-center justify-between gap-1 sm:gap-2 h-[58vh] min-h-[340px] max-h-[580px] md:h-[calc(100dvh-5rem)] md:min-h-[540px] md:max-h-[960px]">
        {/* Seta Lateral Esquerda (Fora da área da arte para zero oclusão) */}
        <div className="w-8 sm:w-12 md:w-14 shrink-0 flex items-center justify-center z-30">
          {slides.length > 1 && (
            <button
              type="button"
              onClick={goToPrev}
              aria-label="Painel anterior"
              className="w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full border border-catalog-gold/45 bg-[#050B14]/90 hover:bg-[#F0B40E] text-[#F0B40E] hover:text-[#010E31] flex items-center justify-center backdrop-blur-md transition-all duration-200 cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F0B40E]"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </div>

        {/* Palco Central (~95% da largura da Hero com proporção expandida e fundo ambiental) */}
        <div className="flex-1 h-full relative rounded-xl sm:rounded-2xl overflow-hidden border border-catalog-gold/25 bg-[#050B14] shadow-2xl">
          {slides.map((slide, idx) => {
            const isActive = idx === safeIndex;

            return (
              <div
                key={slide.id}
                aria-hidden={!isActive}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                  isActive
                    ? 'opacity-100 z-10'
                    : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                {/* Imagem de Fundo Ambiental (Opção B: blur-2xl suave para preenchimento de bordas sem cortes) */}
                <img
                  src={slide.desktopImageUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-30 pointer-events-none select-none"
                />

                {/* Arte Central Nítida Clicável (100% Limpo, sem sobreposição de botões ou textos) */}
                <button
                  type="button"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleSlideAction(slide)}
                  aria-label={slide.altText}
                  className="relative z-10 w-full h-full block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F0B40E]"
                >
                  <picture className="w-full h-full block">
                    {slide.mobileImageUrl && (
                      <source
                        media="(max-width: 767px)"
                        srcSet={slide.mobileImageUrl}
                      />
                    )}
                    <img
                      src={slide.desktopImageUrl}
                      alt={slide.altText}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={idx === 0 ? 'high' : 'auto'}
                      className="w-full h-full object-contain object-center"
                    />
                  </picture>
                </button>

                {/* Vinheta sutil na base para integração suave com os dots de navegação */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 via-black/15 to-transparent z-20"
                  aria-hidden="true"
                />
              </div>
            );
          })}

          {/* Dots Inferiores + Controle de Autoplay (Compacto e não invasivo) */}
          {slides.length > 1 && (
            <div className="absolute bottom-2.5 sm:bottom-4 inset-x-0 z-30 flex items-center justify-center gap-3 pointer-events-none">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#050B14]/80 backdrop-blur-md border border-white/10 pointer-events-auto shadow-lg"
                aria-live="polite"
              >
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Ir para o painel ${idx + 1}: ${s.altText}`}
                    aria-current={idx === safeIndex ? 'true' : undefined}
                    className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F0B40E] ${
                      idx === safeIndex
                        ? 'w-8 bg-[#F0B40E] shadow-[0_0_10px_#F0B40E]'
                        : 'w-2.5 bg-white/40 hover:bg-white/80'
                    }`}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  aria-label={
                    isPaused
                      ? 'Retomar rotação automática dos painéis'
                      : 'Pausar rotação automática dos painéis'
                  }
                  className="ml-1 pl-2 border-l border-white/15 text-slate-300 hover:text-[#F0B40E] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F0B40E]"
                >
                  {isPaused || prefersReducedMotion ? (
                    <Play className="w-3.5 h-3.5" />
                  ) : (
                    <Pause className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Seta Lateral Direita (Fora da área da arte para zero oclusão) */}
        <div className="w-8 sm:w-12 md:w-14 shrink-0 flex items-center justify-center z-30">
          {slides.length > 1 && (
            <button
              type="button"
              onClick={goToNext}
              aria-label="Próximo painel"
              className="w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full border border-catalog-gold/45 bg-[#050B14]/90 hover:bg-[#F0B40E] text-[#F0B40E] hover:text-[#010E31] flex items-center justify-center backdrop-blur-md transition-all duration-200 cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F0B40E]"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
