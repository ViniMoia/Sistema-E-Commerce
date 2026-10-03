"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CATALOG_TAGS } from "./FilterTagPills";
import { PRICE_RANGES } from "./CatalogFreeSidebar";
import { BrandSummary } from "./BrandHoverFlyout";

interface CatalogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedBrand: string | null;
  onSelectBrand: (brand: string | null) => void;
  selectedPriceRange: string | null;
  onSelectPriceRange: (range: string | null) => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearAll: () => void;
  brands: BrandSummary[];
  totalProductsCount: number;
  filteredProductsCount: number;
}

export function CatalogDrawer({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  selectedBrand,
  onSelectBrand,
  selectedPriceRange,
  onSelectPriceRange,
  selectedTags,
  onToggleTag,
  onClearAll,
  brands,
  totalProductsCount,
  filteredProductsCount,
}: CatalogDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fechar com tecla Escape e travar o scroll do body quando aberto
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const activeFiltersCount =
    (selectedBrand ? 1 : 0) +
    selectedTags.length +
    (selectedPriceRange ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex"
      role="dialog"
      aria-modal="true"
      aria-label="Painel de Filtros do Catálogo"
    >
      {/* ─── BACKDROP ESCURO COM BLUR ─── */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ─── PAINEL DESLIZANTE LATERAL DARK & GOLD ─── */}
      <aside className="relative w-full max-w-sm sm:max-w-md bg-[#050B14] border-r border-catalog-gold/40 h-full flex flex-col z-10 shadow-[0_0_50px_rgba(0,0,0,0.9)] animate-in slide-in-from-left duration-300 ease-out">
        
        {/* CABEÇALHO DO DRAWER */}
        <div className="flex items-center justify-between p-5 border-b border-catalog-gold/30 shrink-0 bg-[#050B14]/90 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-catalog-gold shadow-[0_0_8px_#F0B40E]" />
            <span className="text-sm font-mono font-bold tracking-wider text-catalog-gold uppercase">
              Filtros & Categorias
            </span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-catalog-gold/20 border border-catalog-gold/40 text-catalog-gold text-[10px] font-mono font-bold">
                {activeFiltersCount} ativo{activeFiltersCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-white/5 border border-catalog-gold/35 text-gray-300 hover:text-white hover:border-catalog-gold hover:bg-catalog-gold/15 flex items-center justify-center font-bold text-xs transition-all cursor-pointer"
            aria-label="Fechar filtros"
          >
            ✕
          </button>
        </div>

        {/* CORPO ROLÁVEL COM OS FILTROS */}
        <div className="flex-1 overflow-y-auto p-5 space-y-7 scrollbar-thin scrollbar-thumb-catalog-gold/30">
          
          {/* BUSCA RÁPIDA DENTRO DO DRAWER */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono font-bold tracking-wider text-gray-400 uppercase">
              Palavra-chave
            </label>
            <div className="relative group">
              <input
                type="text"
                placeholder="Buscar por nome ou código..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-[#0B132B]/80 border border-catalog-gold/30 text-white placeholder-gray-400 text-xs rounded-xl pl-3.5 pr-8 py-2.5 focus:outline-none focus:border-catalog-gold transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* FAIXAS DE PREÇO */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Por Preço
              </h3>
              {selectedPriceRange && (
                <button
                  type="button"
                  onClick={() => onSelectPriceRange(null)}
                  className="text-[10px] font-mono text-gray-400 hover:text-red-400 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
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
                    className={`text-xs font-mono py-2 px-3 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-catalog-gold text-black font-bold shadow-[0_0_12px_rgba(240,180,14,0.3)]"
                        : "bg-[#0B111E]/60 text-gray-300 hover:text-white hover:bg-white/5 border border-white/5"
                    }`}
                  >
                    <span>{range.label}</span>
                    {isSelected && <span className="font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CATEGORIAS / TAGS */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Categorias
              </h3>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => selectedTags.forEach((t) => onToggleTag(t))}
                  className="text-[10px] font-mono text-gray-400 hover:text-red-400 transition-colors"
                >
                  Limpar ({selectedTags.length})
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {CATALOG_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag.slug);
                return (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => onToggleTag(tag.slug)}
                    className={`text-xs font-mono py-2 px-2.5 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-catalog-gold/20 border border-catalog-gold text-catalog-gold font-bold"
                        : "bg-[#0B111E]/60 text-gray-300 hover:text-white hover:bg-white/5 border border-white/5"
                    }`}
                  >
                    <span className="truncate">{tag.name}</span>
                    {isSelected && <span className="text-catalog-gold text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MARCAS PARCEIRAS */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Marcas
              </h3>
              {selectedBrand && (
                <button
                  type="button"
                  onClick={() => onSelectBrand(null)}
                  className="text-[10px] font-mono text-gray-400 hover:text-red-400 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Filtro rápido de marcas se houver muitas */}
            {brands.length > 8 && (
              <input
                type="text"
                placeholder="Filtrar marcas..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="w-full bg-[#0B132B]/60 border border-white/10 text-white placeholder-gray-500 text-[11px] rounded-lg px-2.5 py-1.5 mb-1 focus:outline-none focus:border-catalog-gold/50"
              />
            )}

            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
              {filteredBrands.map((b) => {
                const isSelected =
                  selectedBrand?.toLowerCase() === b.slug.toLowerCase();
                return (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => onSelectBrand(isSelected ? null : b.slug)}
                    className={`text-xs font-mono py-1.5 px-3 rounded-lg text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-catalog-gold/20 border border-catalog-gold text-catalog-gold font-bold"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate">{b.name}</span>
                    {b.productCount > 0 && (
                      <span className="text-[10px] text-gray-500 font-normal">
                        {b.productCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RODAPÉ DO DRAWER: BOTÃO PRINCIPAL COM GLOW */}
        <div className="p-4 border-t border-catalog-gold/25 shrink-0 bg-[#050B14] space-y-2">
          <button
            onClick={onClose}
            type="button"
            className="w-full py-3 rounded-xl bg-catalog-gold text-black font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(240,180,14,0.3)] hover:bg-[#e0a60a] active:scale-[0.99] transition-all cursor-pointer"
          >
            Ver {filteredProductsCount} Produto{filteredProductsCount !== 1 ? "s" : ""}
          </button>

          {activeFiltersCount > 0 && (
            <button
              onClick={onClearAll}
              type="button"
              className="w-full py-1.5 text-center text-[11px] font-mono text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}

export default CatalogDrawer;
