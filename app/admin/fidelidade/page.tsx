import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoyaltyAdminView } from "@/components/admin/loyalty/LoyaltyAdminView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fidelidade & Pontos | Admin Continental",
  description: "Gestão do programa de fidelidade, parâmetros de resgate e extrato contábil de pontos.",
};

export default async function AdminLoyaltyPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="flex-1 p-6 md:p-10">
      <LoyaltyAdminView />
    </div>
  );
}
