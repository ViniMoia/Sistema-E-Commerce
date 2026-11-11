'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ShoppingBag, Sparkles, ArrowRight } from 'lucide-react';
import { FilterableProduct } from '@/hooks/useProductFilters';

const catalogCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

interface HeroCarouselProps {
  products: FilterableProduct[];
  lojaInfo?: {
    name?: string;
    description?: string;
    whatsappNumber?: string;
    heroSlides?: any;
  };
  onSelectProduct?: (product: FilterableProduct) => void;
  onBuyProduct?: (product: FilterableProduct) => void;
}

export default function HeroCarousel({
  products = [],
  lojaInfo,
  onSelectProduct,
  onBuyProduct,
}: HeroCarouselProps) {
  // Slides: personalizados da loja, produtos em destaque ou primeiros produtos com preço válido
  const slides = React.useMemo(() => {
    if (Array.isArray(lojaInfo?.heroSlides) && lojaInfo.heroSlides.length > 0) {
      return (lojaInfo.heroSlides as any[]).map((s, idx) => ({
        id: s.id || s.productId || `hero-slide-${idx}`,
        name: s.title || s.name || 'Destaque Continental',
        description: s.subtitle || s.description || '',
        imageUrl: s.imageUrl || s.bannerUrl || '',
        heroBannerUrl: s.imageUrl || s.bannerUrl || null,
        price: Number(s.cardPrice || s.price || 0),
        pixPrice: s.pixPrice ? Number(s.pixPrice) : null,
        brandName: s.brandName || null,
        isFeaturedHero: true,
        stock: 99,
        tags: [],
      })) as FilterableProduct[];
    }

    const featured = products.filter((p) => p.isFeaturedHero);
    if (featured.length > 0) return featured.slice(0, 6);
    return products.filter((p) => p.price > 0).slice(0, 5);
  }, [products, lojaInfo?.heroSlides]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Auto-play timer (5 segundos)
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  // Dispara evento hero-car-illuminated para manter compatibilidade
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

  const scrollToCatalog = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById('catalogo');
    if (el) {
      el.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    }
  };

  // Se não houver produtos para o slide, exibe banner institucional
  if (slides.length === 0) {
    return (
      <section className="relative w-full h-[70vh] min-h-[500px] flex items-center justify-center bg-black text-white px-6">
        <div className="text-center max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest text-[#F0B40E] bg-[#F0B40E]/10 border border-[#F0B40E]/30 uppercase">
            <Sparkles className="w-3.5 h-3.5 text-[#F0B40E]" />
            Estética Automotiva de Precisão
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
            CONTINENTAL AUTOMOTIVA
          </h1>
          <p className="text-slate-300 text-sm sm:text-base">
            Produtos profissionais para proteção, polimento e estética automotiva de alto rendimento.
          </p>
          <a
            href="#catalogo"
            onClick={scrollToCatalog}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:brightness-110 transition-all cursor-pointer"
          >
            Explorar Catálogo <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    );
  }

  const currentProduct = slides[currentIndex];
  const cardPrice = currentProduct.price;
  const pixPrice = currentProduct.pixPrice ?? currentProduct.price;
  const bannerImage = currentProduct.heroBannerUrl || currentProduct.imageUrl;

  return (
    <section
      className="relative w-full h-[85vh] sm:h-[80vh] min-h-[560px] max-h-[900px] overflow-hidden bg-black text-white select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
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
      aria-label="Carrossel de Produtos em Destaque"
      role="region"
    >
      {/* Imagem de Fundo em Slide com Transição Suave */}
      {slides.map((product, idx) => {
        const isActive = idx === currentIndex;
        const img = product.heroBannerUrl || product.imageUrl;

        return (
          <div
            key={product.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {img ? (
              <Image
                src={img}
                alt={product.name}
                fill
                priority={idx === 0}
                className="object-cover object-center transform scale-105 motion-safe:transition-transform motion-safe:duration-[8000ms]"
                sizes="100vw"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#010E31] via-[#050B14] to-black" />
            )}

            {/* Gradientes de Contraste Escuro para Leitura */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent w-full md:w-[65%]"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/40 to-black/30"
              aria-hidden="true"
            />
          </div>
        );
      })}

      {/* Conteúdo do Slide Ativo (Título, Preços Duplos e CTAs) */}
      <div className="relative z-20 h-full max-w-[1680px] mx-auto px-6 sm:px-12 lg:px-16 flex items-center">
        <div className="max-w-2xl space-y-5 animate-in fade-in slide-in-from-left-6 duration-700 key={currentProduct.id}">
          {/* Badge de Destaque Continental */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-[#F0B40E]/20 text-[#F0B40E] border border-[#F0B40E]/40 shadow-[0_0_15px_rgba(240,180,14,0.3)]">
              <Sparkles className="w-3.5 h-3.5 text-[#F0B40E]" />
              Destaque Continental
            </span>
            {currentProduct.brandName && (
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                {currentProduct.brandName}
              </span>
            )}
          </div>

          {/* Título do Produto */}
          <h2
            onClick={() => onSelectProduct?.(currentProduct)}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] cursor-pointer hover:text-[#F0B40E] transition-colors drop-shadow-md line-clamp-2"
          >
            {currentProduct.name}
          </h2>

          {/* Descrição resumida */}
          {currentProduct.description && (
            <p className="text-sm sm:text-base text-slate-200/90 font-light line-clamp-2 max-w-xl leading-relaxed">
              {currentProduct.description.replace(/<[^>]*>?/gm, '')}
            </p>
          )}

          {/* Bloco Duplo de Preços (Cartão em destaque gigante + PIX secundário) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#010E31]/75 backdrop-blur-md border border-[#F0B40E]/30 max-w-lg shadow-2xl space-y-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xs sm:text-sm uppercase tracking-wider font-mono text-slate-300 font-semibold">
                No Cartão:
              </span>
              <span className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                {catalogCurrency.format(cardPrice)}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-white/10">
              <span className="text-xs font-mono text-slate-300">À vista no PIX:</span>
              <span className="text-base sm:text-lg font-bold text-emerald-400">
                {catalogCurrency.format(pixPrice)}
              </span>
              {cardPrice > pixPrice && (
                <span className="text-[10px] sm:text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Economia de {catalogCurrency.format(cardPrice - pixPrice)}
                </span>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onBuyProduct ? onBuyProduct(currentProduct) : onSelectProduct?.(currentProduct)}
              className="btn-shimmer px-7 py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] hover:from-[#F5BD1E] hover:to-[#F0B40E] text-[#010E31] font-extrabold text-xs sm:text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] hover:shadow-[0_0_35px_rgba(240,180,14,0.6)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border border-[#F5BD1E]/50"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Comprar Agora</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectProduct?.(currentProduct)}
              className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm tracking-wider uppercase border border-white/20 hover:border-white/40 backdrop-blur-md transition-all cursor-pointer"
            >
              Ver Detalhes
            </button>

            <a
              href="#catalogo"
              onClick={scrollToCatalog}
              className="px-5 py-3.5 rounded-full text-slate-300 hover:text-white font-medium text-xs sm:text-sm tracking-wider uppercase transition-colors underline underline-offset-4 cursor-pointer"
            >
              Ver Catálogo Completo
            </a>
          </div>
        </div>
      </div>

      {/* Setas de Navegação Lateral (Visíveis e com Alto Contraste) */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={goToPrev}
            aria-label="Slide anterior"
            className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-30 p-3 sm:p-3.5 rounded-full bg-black/60 hover:bg-[#F0B40E] text-white hover:text-[#010E31] border border-white/20 hover:border-[#F0B40E] backdrop-blur-md transition-all duration-200 cursor-pointer shadow-xl focus:outline-none focus:ring-2 focus:ring-[#F0B40E]"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={goToNext}
            aria-label="Próximo slide"
            className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-30 p-3 sm:p-3.5 rounded-full bg-black/60 hover:bg-[#F0B40E] text-white hover:text-[#010E31] border border-white/20 hover:border-[#F0B40E] backdrop-blur-md transition-all duration-200 cursor-pointer shadow-xl focus:outline-none focus:ring-2 focus:ring-[#F0B40E]"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Dots Inferiores de Paginação */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 inset-x-0 z-30 flex items-center justify-center gap-2.5">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Ir para o slide ${idx + 1}: ${s.name}`}
              className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F0B40E] ${
                idx === currentIndex
                  ? 'w-8 bg-[#F0B40E] shadow-[0_0_10px_#F0B40E]'
                  : 'w-2.5 bg-white/40 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

