"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CATALOG_TAGS } from "./FilterTagPills";
import { BrandSummary } from "./BrandHoverFlyout";

export interface PriceRangeOption {
  id: string;
  label: string;
  min: number;
  max: number;
}

export const PRICE_RANGES: PriceRangeOption[] = [
  { id: "0-50", label: "até R$50,00", min: 0, max: 50 },
  { id: "50-100", label: "de R$50,00 até R$100,00", min: 50, max: 100 },
  { id: "100-150", label: "de R$100,00 até R$150,00", min: 100, max: 150 },
  { id: "150-200", label: "de R$150,00 até R$200,00", min: 150, max: 200 },
  { id: "200+", label: "a partir de R$200,00", min: 200, max: Infinity },
];

interface CatalogFreeSidebarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedBrand: string | null;
  onSelectBrand: (slug: string | null) => void;
  selectedTags: string[];
  onToggleTag: (slug: string) => void;
  selectedPriceRange: string | null;
  onSelectPriceRange: (range: string | null) => void;
  onClearAll: () => void;
  brands: BrandSummary[];
  totalProductsCount: number;
  filteredProductsCount: number;
}

export function CatalogFreeSidebar({
  searchQuery,
  onSearchChange,
  selectedBrand,
  onSelectBrand,
  selectedTags,
  onToggleTag,
  selectedPriceRange,
  onSelectPriceRange,
  onClearAll,
  brands,
  totalProductsCount,
  filteredProductsCount,
}: CatalogFreeSidebarProps) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasActiveFilters = Boolean(
    selectedBrand ||
    selectedTags.length > 0 ||
    searchQuery.trim() ||
    selectedPriceRange
  );

  const activeFiltersCount =
    (selectedBrand ? 1 : 0) +
    selectedTags.length +
    (searchQuery.trim() ? 1 : 0) +
    (selectedPriceRange ? 1 : 0);

  // Conteúdo modular não-encapsulado (livre na lateral, semelhante à referência 3)
  const renderFreeSidebarContent = () => (
    <div className="flex flex-col gap-6 w-full text-left">
      {/* ─── 1. BARRA DE PESQUISA NO TOPO ─── */}
      <div className="space-y-2">
        <div className="relative group">
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
            className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-xs rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-catalog-gold transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-white"
              title="Limpar busca"
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. CONTADOR DE PRODUTOS ENCONTRADOS ─── */}
      <div className="flex items-center justify-between pb-1 border-b border-catalog-gold/20">
        <span className="text-xs font-mono font-bold text-gray-300">
          {filteredProductsCount} produtos encontrados
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] font-mono text-red-400 hover:text-red-300 underline"
          >
            Limpar tudo
          </button>
        )}
      </div>

      {/* ─── 3. RESUMO DE FILTROS ATIVOS ─── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-catalog-gold/10 border border-catalog-gold/30">
          {selectedBrand && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0B111E] border border-catalog-gold text-catalog-gold text-[10px] font-mono">
              <span>Marca: {selectedBrand}</span>
              <button
                type="button"
                onClick={() => onSelectBrand(null)}
                className="hover:text-white font-bold"
              >
                ✕
              </button>
            </span>
          )}
          {selectedPriceRange && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0B111E] border border-catalog-gold text-catalog-gold text-[10px] font-mono">
              <span>
                Preço:{" "}
                {PRICE_RANGES.find((p) => p.id === selectedPriceRange)?.label}
              </span>
              <button
                type="button"
                onClick={() => onSelectPriceRange(null)}
                className="hover:text-white font-bold"
              >
                ✕
              </button>
            </span>
          )}
          {selectedTags.map((tagSlug) => (
            <span
              key={tagSlug}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0B111E] border border-catalog-gold/60 text-catalog-gold text-[10px] font-mono"
            >
              <span>{CATALOG_TAGS.find((t) => t.slug === tagSlug)?.name || tagSlug}</span>
              <button
                type="button"
                onClick={() => onToggleTag(tagSlug)}
                className="hover:text-white font-bold"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ─── 4. BLOCO LIVRE: "POR PREÇO" ─── */}
      <div className="space-y-2">
        <h3 className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
          Por preço
        </h3>
        <div className="flex flex-col gap-1.5">
          {PRICE_RANGES.map((range) => {
            const isSelected = selectedPriceRange === range.id;
            return (
              <button
                key={range.id}
                type="button"
                onClick={() =>
                  onSelectPriceRange(isSelected ? null : range.id)
                }
                className={`text-xs font-mono py-1 px-2 rounded-lg text-left transition-colors flex items-center justify-between ${
                  isSelected
                    ? "bg-catalog-gold/20 text-catalog-gold font-bold"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{range.label}</span>
                {isSelected && <span className="text-catalog-gold">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 5. BLOCO LIVRE: "CATEGORIAS" ─── */}
      <div className="space-y-2">
        <h3 className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
          Categorias
        </h3>
        <div className="flex flex-col gap-1.5">
          {CATALOG_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag.slug);
            return (
              <button
                key={tag.slug}
                type="button"
                onClick={() => onToggleTag(tag.slug)}
                className={`text-xs font-mono py-1 px-2 rounded-lg text-left transition-colors flex items-center justify-between ${
                  isSelected
                    ? "bg-catalog-gold/20 text-catalog-gold font-bold"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{tag.name}</span>
                {isSelected && <span className="text-catalog-gold">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 6. BLOCO LIVRE: "MARCA" ─── */}
      <div className="space-y-2">
        <h3 className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
          Marca
        </h3>
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto scrollbar-none pr-1">
          {brands.map((b) => {
            const isSelected = selectedBrand?.toLowerCase() === b.slug.toLowerCase();
            return (
              <button
                key={b.slug}
                type="button"
                onClick={() => onSelectBrand(isSelected ? null : b.slug)}
                className={`text-xs font-mono py-0.5 px-2 rounded text-left transition-colors flex items-center justify-between ${
                  isSelected
                    ? "bg-catalog-gold/20 text-catalog-gold font-bold"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="truncate">{b.name}</span>
                {b.productCount > 0 && (
                  <span className="text-[10px] text-gray-500">
                    {b.productCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ─── DESKTOP: LATERAL LIVRE NÃO-ENCAPSULADA (STICKY) ─── */}
      <aside
        aria-label="Filtros Laterais do Catálogo"
        className="hidden lg:block w-56 xl:w-64 shrink-0 sticky top-24 self-start select-none"
      >
        {renderFreeSidebarContent()}
      </aside>

      {/* ─── GATILHO MOBILE ─── */}
      <div className="lg:hidden w-full mb-6">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#0B132B]/80 border border-catalog-gold/30 text-white placeholder-gray-400 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-catalog-gold"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-mono tracking-wider uppercase transition-all shrink-0 ${
              hasActiveFilters
                ? "bg-catalog-gold text-black font-bold border-catalog-gold"
                : "bg-[#0B132B]/80 border-catalog-gold/40 text-catalog-gold"
            }`}
          >
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-black text-catalog-gold text-[9px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── MOBILE DRAWER VIA PORTAL ─── */}
      {isMobileDrawerOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 lg:hidden flex"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setIsMobileDrawerOpen(false)}
            />

            <div className="relative w-full max-w-xs bg-[#050B14] border-r border-catalog-gold/40 h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-300">
              <div className="flex items-center justify-between p-4 border-b border-catalog-gold/30 shrink-0">
                <span className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                  Filtros & Categorias
                </span>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  type="button"
                  className="w-7 h-7 rounded-full bg-white/5 border border-catalog-gold/30 text-gray-300 hover:text-white flex items-center justify-center font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {renderFreeSidebarContent()}
              </div>

              <div className="p-4 border-t border-catalog-gold/20 shrink-0 bg-[#050B14]">
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-catalog-gold text-black font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_#B8A06A]"
                >
                  Ver {filteredProductsCount} Resultados
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default CatalogFreeSidebar;
