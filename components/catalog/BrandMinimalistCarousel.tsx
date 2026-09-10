"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { BrandSummary } from "@/components/catalog/BrandHoverFlyout";

interface BrandMinimalistCarouselProps {
  brands: BrandSummary[];
  selectedBrand: string | null;
  onSelectBrand: (slug: string | null) => void;
}

export function BrandMinimalistCarousel({
  brands,
  selectedBrand,
  onSelectBrand,
}: BrandMinimalistCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (!brands || brands.length === 0) return null;

  // Duplicamos as marcas para garantir navegação contínua e rica
  const displayBrands = [...brands, ...brands, ...brands];

  const handleScroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      // Desliza aproximadamente a largura de 1 slot de marca
      const itemWidth = scrollContainerRef.current.clientWidth / 5;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -itemWidth * 2 : itemWidth * 2,
        behavior: "smooth",
      });
    }
  };

  return (
    <section
      aria-label="Carrossel de Marcas Parceiras"
      className="relative w-full py-8 md:py-10 bg-catalog-bg border-y border-catalog-gold/15 overflow-hidden select-none"
    >
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-12 relative flex items-center">
        {/* Botão de Navegação Esquerda (Circular Minimalista) */}
        <button
          type="button"
          onClick={() => handleScroll("left")}
          aria-label="Marca anterior"
          className="shrink-0 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-catalog-gold/40 bg-[#050B14]/80 hover:bg-catalog-gold text-catalog-gold hover:text-black flex items-center justify-center transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.8)] hover:scale-110 active:scale-95 focus:outline-none"
        >
          <svg
            className="w-5 h-5 -ml-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Trilho de 5 Marcas Soltas (Sem Caixas ou Molduras Pesadas) */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex items-center overflow-x-auto scrollbar-none scroll-smooth mx-4 sm:mx-8 py-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {displayBrands.map((brand, index) => {
            const isSelected =
              selectedBrand?.toLowerCase() === brand.slug.toLowerCase();
            const logoPath = brand.logoUrl || `/brands/${brand.slug}.svg`;

            return (
              <button
                key={`${brand.slug}-${index}`}
                type="button"
                onClick={() => onSelectBrand(isSelected ? null : brand.slug)}
                title={brand.name}
                className="group relative flex-shrink-0 w-1/5 min-w-[160px] sm:min-w-[180px] lg:min-w-[200px] h-20 sm:h-24 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer focus:outline-none px-4"
              >
                {/* Logo Solta com Efeito de Hover e Ativo */}
                <div
                  className={`relative w-full h-12 sm:h-14 flex items-center justify-center transition-all duration-300 ${
                    isSelected
                      ? "scale-110 drop-shadow-[0_0_16px_rgba(184,160,106,0.6)]"
                      : "opacity-80 hover:opacity-100 hover:scale-105 group-hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]"
                  }`}
                >
                  <Image
                    src={logoPath}
                    alt={`Logo da marca ${brand.name}`}
                    width={180}
                    height={56}
                    className="max-h-full max-w-[90%] object-contain pointer-events-none"
                    priority={index < 5}
                  />
                </div>

                {/* Indicador Sutil de Marca Ativa (Halo/Linha Dourada) */}
                {isSelected ? (
                  <div className="mt-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-catalog-gold/20 border border-catalog-gold/60 text-catalog-gold text-[10px] font-mono tracking-wider font-bold animate-in fade-in zoom-in-95 duration-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-catalog-gold animate-pulse" />
                    <span>FILTRANDO</span>
                  </div>
                ) : (
                  <div className="mt-2 h-[18px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="text-[10px] font-mono tracking-wider text-catalog-gold/80 uppercase">
                      {brand.name}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Botão de Navegação Direita (Circular Minimalista) */}
        <button
          type="button"
          onClick={() => handleScroll("right")}
          aria-label="Próxima marca"
          className="shrink-0 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-catalog-gold/40 bg-[#050B14]/80 hover:bg-catalog-gold text-catalog-gold hover:text-black flex items-center justify-center transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.8)] hover:scale-110 active:scale-95 focus:outline-none"
        >
          <svg
            className="w-5 h-5 -mr-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

export default BrandMinimalistCarousel;
