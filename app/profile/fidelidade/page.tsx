import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoyaltyHistoryView } from "@/components/profile/LoyaltyHistoryView";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function LoyaltyProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/profile/fidelidade");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Meu Perfil
        </Link>

        <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-white/5">
          <LoyaltyHistoryView />
        </div>
      </div>
    </div>
  );
}
