export default function AdminLoading() {
  return (
    <section role="status" aria-live="polite" aria-busy="true" className="p-6 md:p-8 space-y-6">
      <p className="text-catalog-text">Carregando painel administrativo...</p>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 motion-safe:animate-pulse">
        {[0, 1, 2, 3].map(key => <div key={key} className="h-32 rounded-xl bg-white/5 border border-white/10" />)}
      </div>
    </section>
  );
}
