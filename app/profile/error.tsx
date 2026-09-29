"use client";

export default function ProfileError({ retry }: { retry: () => void }) {
  return (
    <main className="min-h-screen bg-[#050505] text-catalog-text pt-28 px-4">
      <section
        className="mx-auto max-w-xl rounded-lg border border-red-400/30 bg-red-950/20 p-6 text-center"
        role="alert"
        aria-live="assertive"
      >
        <h1 className="text-xl font-semibold text-white">Não foi possível carregar sua conta</h1>
        <p className="mt-2 text-sm text-catalog-muted">
          Seus pedidos não foram alterados. Tente consultar novamente.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-5 rounded-md bg-catalog-gold px-4 py-2 font-semibold text-black"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
