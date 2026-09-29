import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página não encontrada",
  description: "O endereço informado não existe nesta loja.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-catalog-bg text-catalog-text flex items-center justify-center px-6 py-24">
      <div className="max-w-lg text-center rounded-3xl border border-catalog-gold/30 bg-catalog-card p-8 sm:p-12">
        <p className="text-catalog-gold font-mono text-sm tracking-widest uppercase">Erro 404</p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-white">Página não encontrada</h1>
        <p className="mt-4 text-catalog-muted">
          O endereço pode ter mudado ou não pertence a esta loja.
        </p>
        <Link
          href="/#catalogo"
          className="mt-8 inline-flex min-h-12 items-center rounded-full bg-catalog-gold px-6 text-sm font-bold uppercase tracking-wider text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Voltar ao catálogo
        </Link>
      </div>
    </main>
  );
}

