"use client";

import React from "react";

export interface BrandSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  productCount: number;
}

interface BrandHoverFlyoutProps {
  brands: BrandSummary[];
  selectedBrand: string | null;
  onSelectBrand: (slug: string | null) => void;
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function BrandHoverFlyout({
  brands,
  selectedBrand,
  onSelectBrand,
  isOpen,
  onMouseEnter,
  onMouseLeave,
}: BrandHoverFlyoutProps) {
  if (!isOpen) return null;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute top-full left-0 mt-3 z-50 w-[92vw] max-w-xl sm:max-w-2xl bg-[#0B132B]/95 backdrop-blur-2xl border border-catalog-gold/40 rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-200"
      style={{
        boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(184, 160, 106, 0.15)",
      }}
    >
      {/* Hitbox Bridge para manter o hover suave sem perda de foco */}
      <div className="absolute -top-3 left-0 right-0 h-3 bg-transparent" />

      {/* Header do Flyout */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-catalog-gold/20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-catalog-gold animate-pulse" />
          <span className="text-catalog-gold font-mono text-xs font-bold tracking-[0.2em] uppercase">
            Marcas Parceiras
          </span>
          <span className="text-catalog-muted text-xs font-mono">
            ({brands.length})
          </span>
        </div>

        {selectedBrand && (
          <button
            onClick={() => onSelectBrand(null)}
            className="text-[11px] font-mono text-catalog-gold hover:text-white transition-colors underline decoration-catalog-gold/40 underline-offset-4"
          >
            Limpar Marca
          </button>
        )}
      </div>

      {/* Grid de Marcas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-catalog-gold/30">
        {brands.map((brand) => {
          const isSelected = selectedBrand === brand.slug;
          return (
            <button
              key={brand.id}
              onClick={() => onSelectBrand(isSelected ? null : brand.slug)}
              className={`group relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                isSelected
                  ? "bg-catalog-gold/20 border-catalog-gold shadow-[0_0_15px_rgba(184,160,106,0.3)]"
                  : "bg-catalog-card/70 border-catalog-gold/20 hover:border-catalog-gold/60 hover:bg-catalog-gold/10"
              }`}
            >
              {/* Ícone / Badge da Marca */}
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs uppercase shrink-0 transition-colors ${
                  isSelected
                    ? "bg-catalog-gold text-black shadow-sm"
                    : "bg-black/60 border border-catalog-gold/30 text-catalog-gold group-hover:border-catalog-gold group-hover:text-white"
                }`}
              >
                {brand.name.substring(0, 2)}
              </div>

              {/* Nome e Contagem */}
              <div className="min-w-0 flex-1">
                <div
                  className={`font-semibold text-xs sm:text-sm truncate transition-colors ${
                    isSelected
                      ? "text-catalog-gold"
                      : "text-catalog-text group-hover:text-catalog-gold"
                  }`}
                >
                  {brand.name}
                </div>
                <div className="text-[10px] font-mono text-catalog-muted truncate mt-0.5">
                  {brand.productCount} {brand.productCount === 1 ? "produto" : "produtos"}
                </div>
              </div>

              {/* Indicador de Seleção Ativa */}
              {isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-catalog-gold shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Rodapé do Flyout */}
      <div className="mt-4 pt-3 border-t border-catalog-gold/15 flex items-center justify-between text-[11px] text-catalog-muted font-mono">
        <span>Selecione para filtrar produtos instantaneamente</span>
        <button
          onClick={() => onSelectBrand(null)}
          className="text-catalog-gold hover:text-white transition-colors"
        >
          Ver Todas as Marcas →
        </button>
      </div>
    </div>
  );
}
