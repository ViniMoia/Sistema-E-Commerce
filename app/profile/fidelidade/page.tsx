import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoyaltyHistoryView } from "@/components/profile/LoyaltyHistoryView";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fidelidade & Pontos | Continental Produtos Estéticos Automotivos",
  description: "Consulte seu extrato de pontos e histórico de recompensas.",
};

export default async function LoyaltyProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/profile/fidelidade");
  }

  return (
    <div className="min-h-screen bg-[#050505] text-catalog-text pt-24 md:pt-28 pb-16 px-4 md:px-8 selection:bg-catalog-gold/30">
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
        <Link
          href="/profile"
          className="inline-flex items-center text-catalog-muted hover:text-white transition-colors group w-fit cursor-pointer"
        >
          <span className="group-hover:-translate-x-1 transition-transform duration-300">
            <ArrowLeft className="w-4 h-4 text-catalog-gold" />
          </span>
          <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
            Voltar à Minha Conta
          </span>
        </Link>

        <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <LoyaltyHistoryView />
        </div>
      </div>
    </div>
  );
}

