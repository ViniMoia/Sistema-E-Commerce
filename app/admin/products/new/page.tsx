import { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Novo Produto | Pernambuco Confecções",
  description: "Cadastro de novo produto no catálogo.",
};

export default async function NewProductPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="container mx-auto py-10 max-w-4xl fade-in">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-main)]">
          Cadastrar Novo Produto
        </h1>
        <p className="text-[var(--text-main)]/60">
          Preencha os dados do produto e suas variações de grade e cor.
        </p>
      </div>
      
      <ProductForm lojaID={user.lojaID} />
    </div>
  );
}

