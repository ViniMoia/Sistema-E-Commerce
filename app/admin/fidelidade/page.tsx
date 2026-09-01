import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoyaltyAdminView } from "@/components/admin/loyalty/LoyaltyAdminView";

export default async function AdminLoyaltyPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      <LoyaltyAdminView />
    </div>
  );
}
