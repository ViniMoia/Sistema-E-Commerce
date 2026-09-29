"use client";

import React from "react";
import { BrandSummary } from "./BrandHoverFlyout";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

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
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="md:hidden max-h-[85vh] p-0 bg-[#0A0F1D] border-catalog-gold/40 rounded-t-3xl text-white flex flex-col"
      >
        <div className="px-6 py-4 pr-14 border-b border-catalog-gold/20 shrink-0">
          <SheetTitle className="text-xs font-mono font-bold tracking-widest text-catalog-gold uppercase">
            Selecione uma marca
          </SheetTitle>
          <SheetDescription className="text-[11px] text-catalog-muted mt-1">
            Escolha uma marca para filtrar o catálogo.
          </SheetDescription>
        </div>

        <div className="p-4 overflow-y-auto space-y-2.5 max-h-[60vh]">
          {brands.map((brand) => {
            const isSelected = selectedBrand === brand.slug;
            const initials = brand.name
              .split(" ")
              .map((name) => name[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <button
                key={brand.id || brand.slug}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  onSelectBrand(isSelected ? null : brand.slug);
                  onClose();
                }}
                className={`w-full min-h-[52px] px-4 py-2.5 rounded-xl border flex items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-catalog-gold ${
                  isSelected
                    ? "bg-catalog-gold/20 border-catalog-gold text-white"
                    : "bg-slate-900/60 border-slate-800 text-slate-200 hover:border-catalog-gold/40"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                      isSelected
                        ? "bg-catalog-gold text-slate-950 border-catalog-gold"
                        : "bg-slate-800/90 text-catalog-gold border-catalog-gold/30"
                    }`}
                  >
                    {initials}
                  </span>
                  <span>
                    <span className="font-medium text-sm text-slate-100 block">{brand.name}</span>
                    <span className="text-[11px] text-slate-400">
                      {brand.productCount} {brand.productCount === 1 ? "produto" : "produtos"}
                    </span>
                  </span>
                </span>
                <span aria-hidden="true" className="text-catalog-gold">
                  {isSelected ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-catalog-gold/20 bg-slate-950/60 shrink-0 flex items-center gap-3">
          {selectedBrand && (
            <button
              type="button"
              onClick={() => {
                onSelectBrand(null);
                onClose();
              }}
              className="flex-1 min-h-11 rounded-xl border border-red-500/30 bg-red-950/30 text-red-400 hover:bg-red-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 text-xs font-mono uppercase"
            >
              Limpar marca
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-11 rounded-xl bg-catalog-gold text-slate-950 text-xs font-mono uppercase font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Ver catálogo
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
