import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserOrders } from "@/services/orders.service";
import { ProfileLayout } from "./components/ProfileLayout";

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch orders using the service layer to limit payload and enforce separation of concerns
  const orders = await getUserOrders(user.id, 10);

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--text-main)] py-20 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8 animate-in" style={{ animationDelay: "100ms" }}>
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Minha Conta</h1>
          <p className="text-zinc-400">Gerencie seu perfil e histórico de pedidos.</p>
        </div>

        <ProfileLayout user={user} orders={orders} />
      </div>
    </div>
  );
}
