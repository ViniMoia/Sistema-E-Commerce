"use client";

import React, { useRef } from "react";
import { BrandHoverFlyout, BrandSummary } from "./BrandHoverFlyout";

export interface TagOption {
  slug: string;
  name: string;
}

export const CATALOG_TAGS: TagOption[] = [
  { slug: "acessorios", name: "Acessórios" },
  { slug: "airless", name: "AIRLESS" },
  { slug: "aspiradores", name: "Aspiradores" },
  { slug: "boinas", name: "Boinas" },
  { slug: "ceras-e-selantes", name: "Ceras e Selantes" },
  { slug: "cheirinho-para-carro", name: "Cheirinho Para Carro" },
  { slug: "compressor", name: "Compressor" },
  { slug: "externo", name: "Externo" },
  { slug: "extratoras", name: "Extratoras" },
  { slug: "interno", name: "Interno" },
  { slug: "kit-de-produtos", name: "Kit de Produtos" },
];

interface FilterTagPillsProps {
  brands: BrandSummary[];
  selectedBrand: string | null;
  onSelectBrand: (slug: string | null) => void;
  selectedTags: string[];
  onToggleTag: (slug: string) => void;
  onClearAll: () => void;
}

export function FilterTagPills({
  brands,
  selectedBrand,
  onSelectBrand,
  selectedTags,
  onToggleTag,
  onClearAll,
}: FilterTagPillsProps) {
  const [isFlyoutOpen, setIsFlyoutOpen] = React.useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedBrandObj = brands.find((b) => b.slug === selectedBrand);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsFlyoutOpen(true);
    }, 80);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsFlyoutOpen(false);
    }, 200);
  };

  const hasActiveFilters = Boolean(selectedBrand || selectedTags.length > 0);

  return (
    <div className="relative flex items-center gap-2.5 w-full">
      {/* Botão de MARCAS ancorado (sem overflow para nunca cortar o Flyout) */}
      <div
        className="relative shrink-0 z-40"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={() => setIsFlyoutOpen((prev) => !prev)}
          className={`h-9 px-4 rounded-full border text-xs font-mono tracking-wider uppercase transition-all duration-200 flex items-center gap-2 select-none ${
            selectedBrand
              ? "bg-catalog-gold/25 border-catalog-gold text-catalog-gold font-bold shadow-[0_0_15px_rgba(184,160,106,0.3)]"
              : isFlyoutOpen
              ? "bg-catalog-card border-catalog-gold text-white"
              : "bg-catalog-card/80 border-catalog-gold/30 text-catalog-muted hover:border-catalog-gold/60 hover:text-white"
          }`}
          aria-expanded={isFlyoutOpen}
          aria-haspopup="true"
        >
          <span>{selectedBrandObj ? `Marca: ${selectedBrandObj.name}` : "Marca"}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${
              isFlyoutOpen ? "rotate-180 text-catalog-gold" : ""
            }`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Janela Flutuante de Marcas */}
        <BrandHoverFlyout
          brands={brands}
          selectedBrand={selectedBrand}
          onSelectBrand={(slug) => {
            onSelectBrand(slug);
            setIsFlyoutOpen(false);
          }}
          isOpen={isFlyoutOpen}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* Separador vertical sutil */}
      <div className="h-5 w-px bg-catalog-gold/30 shrink-0 hidden sm:block" />

      {/* Pílulas das 11 Etiquetas com rolagem horizontal suave */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none snap-x py-1 flex-1 min-w-0">
        {CATALOG_TAGS.map((tag) => {
          const isActive = selectedTags.includes(tag.slug);
          return (
            <button
              key={tag.slug}
              onClick={() => onToggleTag(tag.slug)}
              className={`h-9 px-4 rounded-full border text-xs font-mono tracking-wider uppercase transition-all duration-200 shrink-0 select-none flex items-center gap-1.5 ${
                isActive
                  ? "bg-catalog-gold/20 border-catalog-gold text-catalog-gold font-semibold shadow-[0_0_12px_rgba(184,160,106,0.25)]"
                  : "bg-catalog-card/70 border-catalog-gold/25 text-catalog-muted hover:border-catalog-gold/60 hover:text-catalog-text"
              }`}
            >
              {tag.name}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-catalog-gold" />
              )}
            </button>
          );
        })}

        {/* Botão de Limpar Todos os Filtros se houver algum ativo */}
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="h-9 px-3 rounded-full border border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-900/30 hover:border-red-500/60 text-xs font-mono tracking-wider uppercase transition-all shrink-0 flex items-center gap-1"
            title="Limpar todos os filtros"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Limpar</span>
          </button>
        )}
      </div>
    </div>
  );
}
