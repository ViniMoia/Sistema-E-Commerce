import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserOrders } from "@/services/orders.service";
import { ProfileLayout } from "./components/ProfileLayout";
import { User, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Minha Conta | Continental Produtos Estéticos Automotivos",
  description: "Gerencie seu perfil de cliente, endereços e acompanhe o histórico de pedidos.",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Consulta canônica de pedidos via camada de serviço
  const orders = await getUserOrders(user.id, 10, 0, user.lojaID);

  return (
    <div className="min-h-screen bg-[#050505] text-catalog-text pt-24 md:pt-28 pb-16 px-4 md:px-8 selection:bg-catalog-gold/30">
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Botão de Retorno / Voltar às Compras */}
        <Link
          href="/"
          className="inline-flex items-center text-catalog-muted hover:text-white transition-colors group w-fit cursor-pointer"
        >
          <span className="group-hover:-translate-x-1 transition-transform duration-300">
            <ArrowLeft className="w-4 h-4 text-catalog-gold" />
          </span>
          <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
            Voltar às compras
          </span>
        </Link>

        <div className="border-b border-catalog-gold/20 pb-6">
          <div className="flex items-center gap-2 text-catalog-gold text-[10px] font-mono tracking-[0.25em] uppercase mb-1.5 font-bold">
            <User className="w-3.5 h-3.5" />
            <span>Área Exclusiva do Cliente</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-continental-display tracking-tight text-white uppercase">
            Minha Conta
          </h1>
          <p className="text-catalog-muted text-xs sm:text-sm font-light mt-1">
            Gerencie suas informações cadastrais, acompanhe entregas e consulte seu extrato de pontos.
          </p>
        </div>

        <ProfileLayout user={user} orders={orders} />
      </div>
    </div>
  );
}
