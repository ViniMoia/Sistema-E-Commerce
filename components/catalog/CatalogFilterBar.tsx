"use client";

import React from "react";
import { FilterTagPills } from "./FilterTagPills";
import { BrandSummary } from "./BrandHoverFlyout";

interface CatalogFilterBarProps {
  brands: BrandSummary[];
  selectedBrand: string | null;
  onSelectBrand: (slug: string | null) => void;
  selectedTags: string[];
  onToggleTag: (slug: string) => void;
  onClearAll: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function CatalogFilterBar({
  brands,
  selectedBrand,
  onSelectBrand,
  selectedTags,
  onToggleTag,
  onClearAll,
  searchQuery,
  onSearchChange,
}: CatalogFilterBarProps) {
  return (
    <div className="mb-10 pb-6 border-b border-catalog-gold/30 animate-in fade-in duration-300 relative z-30">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Lado Esquerdo: Pílulas de Filtros com o botão de Marcas */}
        <div className="w-full xl:max-w-[calc(100%-340px)] relative z-30">
          <FilterTagPills
            brands={brands}
            selectedBrand={selectedBrand}
            onSelectBrand={onSelectBrand}
            selectedTags={selectedTags}
            onToggleTag={onToggleTag}
            onClearAll={onClearAll}
          />
        </div>

        {/* Lado Direito: Barra de Busca com Estilo Dark & Gold */}
        <div className="w-full xl:w-80 shrink-0">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-catalog-muted group-focus-within:text-catalog-gold transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
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
              className="w-full bg-catalog-card/80 border border-catalog-gold/30 text-catalog-text text-sm rounded-full pl-11 pr-10 py-2 focus:outline-none focus:border-catalog-gold/60 focus:bg-catalog-card transition-all placeholder:text-catalog-muted"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-catalog-muted hover:text-catalog-text transition-colors"
                title="Limpar busca"
              >
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
