"use client";

import React, { useEffect } from "react";
import { BrandSummary } from "./BrandHoverFlyout";

interface BrandBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  brands: BrandSummary[];
  selectedBrand: string | null;
  onSelectBrand: (slug: string | null) => void;
}

export function BrandBottomSheet({
  isOpen,
  onClose,
  brands,
  selectedBrand,
  onSelectBrand,
}: BrandBottomSheetProps) {
  // Trava a rolagem do body enquanto a gaveta inferior estiver aberta
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Fechar com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 md:hidden flex flex-col justify-end animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bottom-sheet-title"
    >
      {/* Backdrop escurecido com toque para fechar */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Painel da Gaveta Inferior (Bottom Sheet) */}
      <div className="relative z-10 w-full max-h-[85vh] bg-[#0A0F1D]/98 backdrop-blur-2xl border-t border-catalog-gold/40 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Alça tátil de arraste (Drag Handle) */}
        <div className="pt-3.5 pb-2 flex justify-center shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-catalog-gold/40 rounded-full" />
        </div>

        {/* Cabeçalho da Gaveta */}
        <div className="px-6 py-3 flex items-center justify-between border-b border-catalog-gold/20 shrink-0">
          <div>
            <span
              id="bottom-sheet-title"
              className="text-xs font-mono font-bold tracking-widest text-catalog-gold uppercase"
            >
              Selecione uma Marca
            </span>
            <p className="text-[11px] text-catalog-muted mt-0.5">
              Toque em uma marca para filtrar o catálogo
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:border-catalog-gold/50 flex items-center justify-center transition-colors"
            aria-label="Fechar gaveta de marcas"
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
        </div>

        {/* Lista de Marcas com rolagem fluida e alvos de toque generosos (≥48px) */}
        <div className="p-4 overflow-y-auto space-y-2.5 max-h-[60vh] scrollbar-thin scrollbar-thumb-catalog-gold/20">
          {brands.map((brand) => {
            const isSelected = selectedBrand === brand.slug;
            const initials = brand.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <button
                key={brand.id || brand.slug}
                onClick={() => {
                  onSelectBrand(isSelected ? null : brand.slug);
                  onClose();
                }}
                className={`w-full min-h-[52px] px-4 py-2.5 rounded-xl border flex items-center justify-between text-left transition-all duration-150 active:scale-[0.98] ${
                  isSelected
                    ? "bg-catalog-gold/20 border-catalog-gold text-white shadow-[0_0_15px_rgba(184,160,106,0.3)]"
                    : "bg-slate-900/60 border-slate-800 text-slate-200 hover:border-catalog-gold/40 active:bg-slate-800/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Badge de Iniciais ou Logo */}
                  <div
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                      isSelected
                        ? "bg-catalog-gold text-slate-950 border-catalog-gold"
                        : "bg-slate-800/90 text-catalog-gold border-catalog-gold/30"
                    }`}
                  >
                    {initials}
                  </div>

                  <div>
                    <div className="font-medium text-sm text-slate-100 flex items-center gap-1.5">
                      <span>{brand.name}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-catalog-gold" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {brand.productCount}{" "}
                      {brand.productCount === 1 ? "produto" : "produtos"}
                    </span>
                  </div>
                </div>

                {/* Indicador de Seleção / Check */}
                <div className="shrink-0">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-catalog-gold flex items-center justify-center text-slate-950">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-slate-700" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Rodapé da Gaveta */}
        <div className="p-4 border-t border-catalog-gold/20 bg-slate-950/60 shrink-0 flex items-center gap-3">
          {selectedBrand && (
            <button
              onClick={() => {
                onSelectBrand(null);
                onClose();
              }}
              className="flex-1 h-11 rounded-xl border border-red-500/30 bg-red-950/30 text-red-400 hover:bg-red-900/40 text-xs font-mono tracking-wider uppercase font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
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
              Limpar Filtro de Marca
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-catalog-gold text-slate-950 text-xs font-mono tracking-wider uppercase font-bold hover:bg-catalog-gold/90 transition-colors flex items-center justify-center"
          >
            Ver Catálogo
          </button>
        </div>

      </div>
    </div>
  );
}
