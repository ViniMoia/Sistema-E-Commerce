"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PackageSearch,
  ShoppingCart,
  Users,
  UserCog,
  Truck,
  ArrowLeft,
  Menu,
  X,
  Settings,
} from "lucide-react";
import { useState } from "react";

interface AdminSidebarProps {
  adminName: string;
  adminInitials: string;
  adminAvatarUrl?: string | null;
  lojaName?: string;
}

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/products",
    label: "Produtos",
    icon: PackageSearch,
    exact: false,
  },
  {
    href: "/admin/orders",
    label: "Pedidos",
    icon: ShoppingCart,
    exact: false,
  },
  {
    href: "/admin/customers",
    label: "Clientes",
    icon: Users,
    exact: false,
  },
  {
    href: "/admin/users",
    label: "Usuários",
    icon: UserCog,
    exact: false,
  },
  {
    href: "/admin/freight",
    label: "Frete",
    icon: Truck,
    exact: false,
  },
  {
    href: "/admin/settings",
    label: "Pix e Contato",
    icon: Settings,
    exact: false,
  },
];

function SidebarContent({
  adminName,
  adminInitials,
  adminAvatarUrl,
  lojaName = "Admin",
  onClose,
}: AdminSidebarProps & { onClose?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_10px_var(--primary)] animate-pulse shrink-0" />
          <div>
            <p className="text-white text-xs font-bold tracking-widest uppercase leading-none">
              {lojaName}
            </p>
            <p className="text-primary text-[10px] font-mono tracking-[0.2em] uppercase mt-0.5">
              Admin Panel
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors md:hidden"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <p className="text-[10px] text-zinc-600 font-mono tracking-[0.2em] uppercase px-3 mb-3">
          Navegação
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                }
              `}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                  active ? "text-primary" : ""
                }`}
              />
              <span>{label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer — Admin Info + Back to Store */}
      <div className="px-3 py-4 border-t border-white/5 space-y-2">
        {/* Admin profile chip */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center overflow-hidden shrink-0">
            {adminAvatarUrl ? (
              <img
                src={adminAvatarUrl}
                alt={adminName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-primary text-xs font-bold">
                {adminInitials}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{adminName}</p>
            <p className="text-[10px] text-primary font-mono tracking-wider">
              Admin
            </p>
          </div>
        </div>

        {/* Back to store */}
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent transition-all duration-200 group"
        >
          <ArrowLeft className="w-4 h-4 shrink-0 group-hover:-translate-x-1 transition-transform duration-200" />
          <span>Voltar à Loja</span>
        </Link>
      </div>
    </div>
  );
}

export function AdminSidebar(props: AdminSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md text-white"
        aria-label="Abrir menu admin"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`
          md:hidden fixed inset-y-0 left-0 z-50 w-72
          bg-[#0a0a0a] border-r border-white/5
          transform transition-transform duration-300 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <SidebarContent {...props} onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-[#0a0a0a] border-r border-white/5 min-h-screen sticky top-0 h-screen overflow-hidden">
        <SidebarContent {...props} />
      </aside>
    </>
  );
}
