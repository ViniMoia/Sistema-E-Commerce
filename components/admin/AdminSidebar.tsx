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
  Award,
} from "lucide-react";
import { useState } from "react";
import { ContinentalLogo } from "@/components/brand/ContinentalLogo";

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
    href: "/admin/fidelidade",
    label: "Fidelidade & Pontos",
    icon: Award,
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
    <div className="flex flex-col h-full bg-[#050B14]">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-catalog-gold/20 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <ContinentalLogo
            variant="symbol"
            href="/admin"
            className="h-10 w-auto"
            priority
          />
          <div className="flex flex-col">
            <span className="text-white text-xs font-bold font-continental-display tracking-wider uppercase leading-none">
              Continental
            </span>
            <span className="text-catalog-gold text-[10px] font-mono tracking-[0.2em] uppercase mt-1">
              Painel Admin
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-catalog-muted hover:text-white transition-colors md:hidden"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        <p className="text-[10px] text-catalog-gold/60 font-mono tracking-[0.2em] uppercase px-3 mb-3">
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
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium tracking-wide uppercase transition-all duration-200 group
                ${
                  active
                    ? "bg-catalog-gold/15 text-[#F0B40E] font-bold border border-catalog-gold/40 shadow-[0_0_15px_rgba(240,180,14,0.12)]"
                    : "text-catalog-muted hover:text-white hover:bg-white/[0.03] border border-transparent"
                }
              `}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                  active ? "text-[#F0B40E]" : "text-catalog-muted group-hover:text-white"
                }`}
              />
              <span className="font-mono text-xs">{label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F0B40E] shadow-[0_0_6px_#F0B40E]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer — Admin Info + Back to Store */}
      <div className="px-3 py-4 border-t border-catalog-gold/20 space-y-2">
        {/* Admin profile chip */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#0B132B]/70 border border-catalog-gold/30">
          <div className="w-8 h-8 rounded-full bg-catalog-gold/15 border border-catalog-gold/40 flex items-center justify-center overflow-hidden shrink-0">
            {adminAvatarUrl ? (
              <img
                src={adminAvatarUrl}
                alt={adminName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-catalog-gold text-xs font-bold font-mono">
                {adminInitials}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{adminName}</p>
            <p className="text-[10px] text-catalog-gold font-mono tracking-wider uppercase font-semibold">
              Admin
            </p>
          </div>
        </div>

        {/* Back to store */}
        <Link
          href="/"
          className="inline-flex items-center px-3 py-2.5 text-catalog-muted hover:text-white transition-colors group w-full cursor-pointer"
        >
          <span className="group-hover:-translate-x-1 transition-transform duration-300">
            <ArrowLeft className="w-4 h-4 text-catalog-gold" />
          </span>
          <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
            Voltar à Loja
          </span>
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
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-[#050B14]/90 border border-catalog-gold/40 backdrop-blur-md text-catalog-gold"
        aria-label="Abrir menu admin"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`
          md:hidden fixed inset-y-0 left-0 z-50 w-72
          bg-[#050B14] border-r border-catalog-gold/20
          transform transition-transform duration-300 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <SidebarContent {...props} onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-[#050B14] border-r border-catalog-gold/20 min-h-screen sticky top-0 h-screen overflow-hidden">
        <SidebarContent {...props} />
      </aside>
    </>
  );
}
