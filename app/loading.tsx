import React from "react";

export default function HomeLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-screen bg-[#050505] text-white pt-20 px-4 md:px-8 max-w-[1680px] mx-auto space-y-8"
    >
      <span className="sr-only">Carregando catálogo de produtos...</span>
      <div className="space-y-8 motion-safe:animate-pulse">
        {/* Hero Painéis Carousel Skeleton (~95% da tela com altura responsiva) */}
        <div className="w-full h-[58vh] min-h-[340px] max-h-[580px] md:h-[calc(100dvh-5rem)] md:min-h-[540px] md:max-h-[960px] rounded-2xl bg-neutral-900/80 border border-catalog-gold/20 flex flex-col justify-end p-6 md:p-10 space-y-3">
          <div className="h-3 w-36 rounded bg-catalog-gold/25 mx-auto" />
        </div>

        {/* Carousel de Marcas Skeleton */}
        <div className="flex gap-4 overflow-hidden py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-32 shrink-0 rounded-2xl bg-neutral-900/60 border border-white/5 flex items-center justify-center"
            >
              <div className="h-4 w-20 rounded bg-white/5" />
            </div>
          ))}
        </div>

        {/* Toolbar de Filtros Skeleton */}
        <div className="h-14 w-full rounded-2xl bg-neutral-900/50 border border-white/5 flex items-center justify-between px-6">
          <div className="h-5 w-32 rounded bg-neutral-800" />
          <div className="flex gap-3">
            <div className="h-9 w-28 rounded-xl bg-white/5 border border-white/10" />
            <div className="h-9 w-28 rounded-xl bg-white/5 border border-white/10" />
          </div>
        </div>

        {/* Grid de Produtos Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-neutral-900/60 border border-catalog-gold/20 p-4 space-y-4 shadow-xl"
            >
              {/* Imagem do Produto */}
              <div className="w-full aspect-square rounded-xl bg-neutral-800/80 border border-white/5" />

              {/* Informações */}
              <div className="space-y-2">
                <div className="h-3 w-20 rounded bg-catalog-gold/20" />
                <div className="h-4 w-4/5 rounded bg-neutral-800" />
                <div className="h-3 w-2/3 rounded bg-neutral-800/50" />
              </div>

              {/* Preço e Botão */}
              <div className="pt-2 flex items-center justify-between border-t border-white/5">
                <div className="h-6 w-24 rounded bg-catalog-gold/30" />
                <div className="h-9 w-20 rounded-xl bg-white/5 border border-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

