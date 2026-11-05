import React from "react";

export default function ProfileLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-screen bg-[#050505] text-catalog-text pt-24 md:pt-28 pb-16 px-4 md:px-8 selection:bg-catalog-gold/30"
    >
      <span className="sr-only">Carregando painel da conta...</span>
      <div className="max-w-6xl mx-auto space-y-6 motion-safe:animate-pulse">
        {/* Botão de Retorno / Voltar às Compras Skeleton */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-catalog-gold/30" />
          <div className="h-4 w-36 rounded bg-neutral-800" />
        </div>

        {/* Header do Perfil Skeleton */}
        <div className="border-b border-catalog-gold/20 pb-6 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-catalog-gold/40" />
            <div className="h-3 w-40 rounded bg-catalog-gold/20" />
          </div>
          <div className="h-9 w-56 rounded bg-neutral-800" />
          <div className="h-4 w-80 max-w-full rounded bg-neutral-800/60" />
        </div>

        {/* Layout Grid: Sidebar e Conteúdo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar Skeleton */}
          <div className="md:col-span-1 bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 h-fit space-y-6 shadow-2xl backdrop-blur-xl">
            {/* Avatar Skeleton */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-neutral-800 border-2 border-catalog-gold/30" />
              <div className="h-4 w-32 rounded bg-neutral-800" />
              <div className="h-3 w-44 rounded bg-neutral-800/60" />
            </div>

            {/* Abas Skeleton */}
            <div className="flex flex-col space-y-2 pt-2 border-t border-catalog-gold/20">
              <div className="h-11 w-full rounded-xl bg-gradient-to-r from-catalog-gold/15 to-catalog-gold/5 border border-catalog-gold/40" />
              <div className="h-11 w-full rounded-xl bg-[#0B132B]/50 border border-white/5" />
              <div className="h-11 w-full rounded-xl bg-[#0B132B]/50 border border-white/5" />
            </div>
          </div>

          {/* Área Principal Skeleton */}
          <div className="md:col-span-3 space-y-6">
            <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl">
              <div className="h-6 w-48 rounded bg-neutral-800" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-12 rounded-xl bg-white/5 border border-white/10" />
                <div className="h-12 rounded-xl bg-white/5 border border-white/10" />
                <div className="h-12 rounded-xl bg-white/5 border border-white/10" />
                <div className="h-12 rounded-xl bg-white/5 border border-white/10" />
              </div>
              <div className="h-11 w-40 rounded-xl bg-catalog-gold/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

