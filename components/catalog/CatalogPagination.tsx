"use client";

import React, { useMemo } from "react";

export interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Algoritmo robusto de janela numérica para paginação com reticências.
 * Mantém um número fixo e previsível de slots, eliminando layout jitter.
 */
export function getPaginationRange(
  current: number,
  total: number
): (number | "ellipsis-start" | "ellipsis-end")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // Bloco inicial (ex: páginas 1 a 4)
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-end", total];
  }

  // Bloco final (ex: últimas 4 páginas)
  if (current >= total - 3) {
    return [1, "ellipsis-start", total - 4, total - 3, total - 2, total - 1, total];
  }

  // Bloco intermediário
  return [1, "ellipsis-start", current - 1, current, current + 1, "ellipsis-end", total];
}

/**
 * Componente visual de paginação do catálogo da Continental Produtos Estéticos Automotivos.
 * Segue estritamente os tokens Dark & Gold, com responsividade adaptativa para Desktop e Mobile.
 */
export function CatalogPagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  className = "",
}: CatalogPaginationProps) {
  // Se houver 1 página ou menos, não renderiza barra de navegação
  if (totalPages <= 1) {
    return null;
  }

  const paginationRange = useMemo(
    () => getPaginationRange(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <nav
      role="navigation"
      aria-label="Paginação do catálogo de produtos"
      className={`w-full flex flex-col items-center gap-4 py-8 select-none ${className}`}
    >
      {/* ─── Informações Contextuais de Contagem ─────────────────────────── */}
      <div className="text-xs font-mono text-catalog-muted tracking-widest uppercase flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-catalog-gold/60" />
        <span>
          Mostrando <strong className="text-catalog-gold font-semibold">{startIndex}–{endIndex}</strong> de{" "}
          <strong className="text-catalog-text font-semibold">{totalItems}</strong> produtos
        </span>
      </div>

      {/* ─── Controles Principais de Navegação ───────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Botão Anterior */}
        <button
          type="button"
          onClick={() => canGoPrev && onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          aria-label="Ir para a página anterior"
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border flex items-center justify-center transition-all duration-300 ${
            canGoPrev
              ? "border-catalog-gold/40 bg-[#050B14]/80 text-catalog-gold hover:bg-catalog-gold hover:text-black hover:scale-105 active:scale-95 shadow-[0_2px_12px_rgba(0,0,0,0.6)] cursor-pointer"
              : "border-catalog-gold/15 bg-transparent text-catalog-muted/30 cursor-not-allowed opacity-40"
          }`}
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

        {/* ─── Visualização Mobile: Modo Compacto Central ─────────────────── */}
        <div className="flex sm:hidden items-center px-4 py-2 rounded-xl bg-catalog-card border border-catalog-gold/30 text-xs font-mono">
          <span className="text-catalog-muted">Pág.</span>
          <span className="mx-1.5 text-catalog-gold font-bold">{currentPage}</span>
          <span className="text-catalog-muted/60">/</span>
          <span className="ml-1.5 text-catalog-text font-medium">{totalPages}</span>
        </div>

        {/* ─── Visualização Desktop: Janela Numérica com Reticências ───────── */}
        <div className="hidden sm:flex items-center gap-1.5">
          {paginationRange.map((item, index) => {
            if (item === "ellipsis-start" || item === "ellipsis-end") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="w-9 h-10 flex items-center justify-center text-catalog-gold/50 font-mono text-sm tracking-widest select-none"
                  aria-hidden="true"
                >
                  ...
                </span>
              );
            }

            const pageNumber = item as number;
            const isActive = pageNumber === currentPage;

            return (
              <button
                key={`page-${pageNumber}`}
                type="button"
                onClick={() => onPageChange(pageNumber)}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Ir para a página ${pageNumber}`}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-xs font-mono font-bold transition-all duration-300 flex items-center justify-center cursor-pointer ${
                  isActive
                    ? "border border-catalog-gold bg-catalog-gold/20 text-catalog-gold shadow-[0_0_14px_rgba(212,175,55,0.3)] scale-105"
                    : "border border-catalog-gold/20 bg-catalog-card text-catalog-muted hover:border-catalog-gold/60 hover:text-catalog-text hover:bg-catalog-gold/10 hover:scale-105 active:scale-95"
                }`}
              >
                {pageNumber}
              </button>
            );
          })}
        </div>

        {/* Botão Próximo */}
        <button
          type="button"
          onClick={() => canGoNext && onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          aria-label="Ir para a próxima página"
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border flex items-center justify-center transition-all duration-300 ${
            canGoNext
              ? "border-catalog-gold/40 bg-[#050B14]/80 text-catalog-gold hover:bg-catalog-gold hover:text-black hover:scale-105 active:scale-95 shadow-[0_2px_12px_rgba(0,0,0,0.6)] cursor-pointer"
              : "border-catalog-gold/15 bg-transparent text-catalog-muted/30 cursor-not-allowed opacity-40"
          }`}
        >
          <svg
            className="w-5 h-5 ml-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
