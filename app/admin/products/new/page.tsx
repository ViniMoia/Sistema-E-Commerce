import { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Novo Produto | Painel Administrativo",
  description: "Cadastro de novo produto no catálogo Continental.",
};

export default async function NewProductPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-catalog-bg text-catalog-text p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="border-b border-catalog-gold/20 pb-6">
          <span className="text-[10px] text-catalog-gold font-mono tracking-[0.25em] uppercase border border-catalog-gold/45 px-2.5 py-1 rounded inline-block mb-2 font-bold">
            Catálogo & Estoque
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase font-mono">
            Cadastrar Novo Produto
          </h1>
          <p className="text-catalog-muted mt-1 text-xs sm:text-sm font-light">
            Preencha as especificações técnicas, foto em alta resolução e grade de variantes.
          </p>
        </div>

        <ProductForm lojaID={user.lojaID} />
      </div>
    </div>
  );
}
