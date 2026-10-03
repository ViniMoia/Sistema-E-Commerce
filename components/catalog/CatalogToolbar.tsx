"use client";

import React from "react";
import { CATALOG_TAGS } from "./FilterTagPills";
import { PRICE_RANGES } from "./CatalogFreeSidebar";
import { BrandSummary } from "./BrandHoverFlyout";

interface CatalogToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedBrand: string | null;
  onSelectBrand: (brand: string | null) => void;
  selectedPriceRange: string | null;
  onSelectPriceRange: (range: string | null) => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearAll: () => void;
  onOpenDrawer: () => void;
  totalProductsCount: number;
  filteredProductsCount: number;
  brands: BrandSummary[];
}

export function CatalogToolbar({
  searchQuery,
  onSearchChange,
  selectedBrand,
  onSelectBrand,
  selectedPriceRange,
  onSelectPriceRange,
  selectedTags,
  onToggleTag,
  onClearAll,
  onOpenDrawer,
  totalProductsCount,
  filteredProductsCount,
  brands,
}: CatalogToolbarProps) {
  const activeFiltersCount =
    (selectedBrand ? 1 : 0) +
    selectedTags.length +
    (selectedPriceRange ? 1 : 0);

  const hasAnyFilter = activeFiltersCount > 0 || Boolean(searchQuery.trim());

  // Resolver nome legível da marca selecionada
  const selectedBrandObj = selectedBrand
    ? brands.find((b) => b.slug.toLowerCase() === selectedBrand.toLowerCase())
    : null;
  const brandDisplayName = selectedBrandObj ? selectedBrandObj.name : selectedBrand;

  const priceRangeLabel = selectedPriceRange
    ? PRICE_RANGES.find((p) => p.id === selectedPriceRange)?.label
    : null;

  return (
    <div className="w-full mb-8 space-y-4 animate-in fade-in duration-300">
      {/* ─── LINHA PRINCIPAL: GATILHO DE FILTROS + BUSCA + CONTADOR ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 bg-[#050B14]/80 p-3 sm:p-4 rounded-2xl border border-catalog-gold/25 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
        
        {/* LADO ESQUERDO: BOTÃO DE FILTROS PREMIUM */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Abrir painel de filtros"
            className={`group relative flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl border text-xs sm:text-sm font-mono tracking-wider uppercase transition-all duration-300 shadow-sm cursor-pointer select-none ${
              activeFiltersCount > 0
                ? "bg-catalog-gold text-black font-bold border-catalog-gold shadow-[0_0_18px_rgba(240,180,14,0.35)] hover:bg-[#e0a60a]"
                : "bg-[#0B132B]/80 hover:bg-catalog-gold/15 text-catalog-gold border-catalog-gold/45 hover:border-catalog-gold"
            }`}
          >
            {/* Ícone de Sliders / Filtros de Alta Precisão */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-300 group-hover:rotate-90 ${
                activeFiltersCount > 0 ? "text-black" : "text-catalog-gold"
              }`}
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>

            <span>Filtros</span>

            {/* Badge de Contagem Dinâmica */}
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-black text-catalog-gold text-[10px] font-bold flex items-center justify-center border border-catalog-gold/50 shadow-inner">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Contador Discreto em Telas Maiores */}
          <span className="hidden md:inline-block text-xs font-mono text-gray-400">
            <span className="text-white font-bold">{filteredProductsCount}</span> de{" "}
            <span>{totalProductsCount}</span> produtos
          </span>
        </div>

        {/* LADO DIREITO: BARRA DE PESQUISA INTEGRADA */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative group w-full sm:w-72 md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-catalog-gold transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#0B132B]/80 border border-catalog-gold/30 text-white placeholder-gray-400 text-xs sm:text-sm rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/50 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors"
                title="Limpar pesquisa"
              >
                ✕
              </button>
            )}
          </div>

          {/* Contador Mobile */}
          <span className="md:hidden shrink-0 text-[11px] font-mono text-gray-400">
            {filteredProductsCount} itens
          </span>
        </div>
      </div>

      {/* ─── LINHA DE CHIPS DOS FILTROS ATIVOS (VISIBILIDADE IMEDIATA) ─── */}
      {hasAnyFilter && (
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="text-[11px] font-mono text-catalog-gold uppercase tracking-wider mr-1">
            Filtros ativos:
          </span>

          {/* Chip de Busca */}
          {searchQuery.trim() && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B132B] border border-catalog-gold/45 text-white text-xs font-mono shadow-sm">
              <span className="text-gray-400">Busca:</span>
              <span className="text-catalog-gold font-semibold truncate max-w-[120px]">
                &quot;{searchQuery}&quot;
              </span>
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-gray-400 hover:text-red-400 ml-0.5 font-bold transition-colors"
                title="Remover busca"
              >
                ✕
              </button>
            </span>
          )}

          {/* Chip de Marca */}
          {selectedBrand && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B132B] border border-catalog-gold/45 text-white text-xs font-mono shadow-sm">
              <span className="text-gray-400">Marca:</span>
              <span className="text-catalog-gold font-semibold">
                {brandDisplayName}
              </span>
              <button
                type="button"
                onClick={() => onSelectBrand(null)}
                className="text-gray-400 hover:text-red-400 ml-0.5 font-bold transition-colors"
                title="Remover marca"
              >
                ✕
              </button>
            </span>
          )}

          {/* Chip de Faixa de Preço */}
          {selectedPriceRange && priceRangeLabel && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B132B] border border-catalog-gold/45 text-white text-xs font-mono shadow-sm">
              <span className="text-gray-400">Preço:</span>
              <span className="text-catalog-gold font-semibold">
                {priceRangeLabel}
              </span>
              <button
                type="button"
                onClick={() => onSelectPriceRange(null)}
                className="text-gray-400 hover:text-red-400 ml-0.5 font-bold transition-colors"
                title="Remover filtro de preço"
              >
                ✕
              </button>
            </span>
          )}

          {/* Chips de Categorias/Tags */}
          {selectedTags.map((tagSlug) => {
            const tagName =
              CATALOG_TAGS.find((t) => t.slug === tagSlug)?.name || tagSlug;
            return (
              <span
                key={tagSlug}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B132B] border border-catalog-gold/45 text-white text-xs font-mono shadow-sm"
              >
                <span className="text-catalog-gold font-semibold">{tagName}</span>
                <button
                  type="button"
                  onClick={() => onToggleTag(tagSlug)}
                  className="text-gray-400 hover:text-red-400 ml-0.5 font-bold transition-colors"
                  title={`Remover tag ${tagName}`}
                >
                  ✕
                </button>
              </span>
            );
          })}

          {/* Botão Limpar Todos */}
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] font-mono text-red-400 hover:text-red-300 underline underline-offset-4 ml-1 transition-colors"
          >
            Limpar todos
          </button>
        </div>
      )}
    </div>
  );
}

export default CatalogToolbar;
