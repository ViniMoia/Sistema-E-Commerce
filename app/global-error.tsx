"use client";

import "./globals.css";
import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[GLOBAL_RENDER_ERROR]", error.digest || error.name);
  }, [error]);

  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-catalog-bg text-catalog-text">
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
          <div role="alert" className="max-w-lg text-center rounded-3xl border border-red-500/30 bg-catalog-card p-8 sm:p-12">
            <h1 className="text-3xl font-bold text-white">A loja encontrou um problema</h1>
            <p className="mt-4 text-catalog-muted">Nenhum dado foi perdido nesta tela. Tente carregar a aplicação novamente.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-8 min-h-12 rounded-full bg-catalog-gold px-6 text-sm font-bold uppercase tracking-wider text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Recarregar aplicação
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}

