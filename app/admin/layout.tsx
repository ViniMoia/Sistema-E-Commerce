import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user || !user.lojaID) {
    return {
      title: "Painel Admin",
    };
  }

  const loja = await prisma.loja.findUnique({
    where: { id: user.lojaID },
    select: { name: true },
  });

  const name = loja?.name || "E-Commerce";

  return {
    title: {
      template: `%s | Admin — ${name}`,
      default: `Painel Admin | ${name}`,
    },
  };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Defense in depth: middleware handles the redirect, but we also
  // check here for cases where the middleware cache is stale.
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const loja = await prisma.loja.findUnique({
    where: { id: user.lojaID },
    select: { name: true },
  });
  const lojaName = loja?.name || "Admin";

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#050505] text-[#e5e5e5]">
      <AdminSidebar
        adminName={user.name}
        adminInitials={initials}
        adminAvatarUrl={user.avatarImageUrl}
        lojaName={lojaName}
      />

      {/* Main content area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
