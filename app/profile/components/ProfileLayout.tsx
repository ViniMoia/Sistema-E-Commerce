"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Award, User, ShoppingBag } from "lucide-react";
import { AvatarManager } from "./AvatarManager";
import { OrderHistoryList } from "./OrderHistoryList";
import { ProfileForm } from "./ProfileForm";
import { LoyaltyHistoryView } from "@/components/profile/LoyaltyHistoryView";
import { UserProfile, UserOrder } from "../types";

interface ProfileLayoutProps {
  user: UserProfile;
  orders: UserOrder[];
}

export function ProfileLayout({ user, orders }: ProfileLayoutProps) {
  const [activeTab, setActiveTab] = useState<"info" | "orders" | "loyalty">("info");

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      {/* Sidebar do Perfil */}
      <div className="md:col-span-1 bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 h-fit space-y-6 shadow-2xl backdrop-blur-xl">
        <AvatarManager user={user} />
        
        <div className="flex flex-col space-y-2 pt-2 border-t border-catalog-gold/20">
          {/* Aba Informações Pessoais */}
          <button 
            onClick={() => setActiveTab("info")}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-2.5 font-mono text-xs uppercase tracking-wider cursor-pointer ${
              activeTab === "info"
                ? "bg-gradient-to-r from-catalog-gold/15 to-catalog-gold/5 text-catalog-gold font-bold border border-catalog-gold/60 shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                : "bg-[#0B132B]/50 text-neutral-400 border border-white/5 hover:border-catalog-gold/30 hover:text-white"
            }`}
          >
            <User className="w-4 h-4 text-catalog-gold" />
            <span>Informações Pessoais</span>
          </button>

          {/* Aba Meus Pedidos */}
          <button 
            onClick={() => setActiveTab("orders")}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between font-mono text-xs uppercase tracking-wider cursor-pointer ${
              activeTab === "orders"
                ? "bg-gradient-to-r from-catalog-gold/15 to-catalog-gold/5 text-catalog-gold font-bold border border-catalog-gold/60 shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                : "bg-[#0B132B]/50 text-neutral-400 border border-white/5 hover:border-catalog-gold/30 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4 text-catalog-gold" />
              <span>Meus Pedidos</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#050B14] border border-catalog-gold/30 text-catalog-gold font-bold">
              {orders.length}
            </span>
          </button>

          {/* Aba Pontos & Fidelidade */}
          <button 
            onClick={() => setActiveTab("loyalty")}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between font-mono text-xs uppercase tracking-wider cursor-pointer ${
              activeTab === "loyalty"
                ? "bg-gradient-to-r from-catalog-gold/15 to-catalog-gold/5 text-catalog-gold font-bold border border-catalog-gold/60 shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                : "bg-[#0B132B]/50 text-neutral-400 border border-white/5 hover:border-catalog-gold/30 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Award className="w-4 h-4 text-catalog-gold" />
              <span>Fidelidade & Pontos</span>
            </span>
          </button>

          {/* Acesso ao Painel Admin — Exclusivo para papel ADMIN */}
          {user.role === "ADMIN" && (
            <div className="pt-3 border-t border-catalog-gold/20">
              <Link
                href="/admin"
                className="btn-shimmer w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#F0B40E] to-[#DDAF02] text-black font-bold font-mono text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
              >
                <LayoutDashboard className="w-4 h-4 text-black" />
                <span>Painel Admin</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo Principal da Aba Ativa */}
      <div className="md:col-span-3 bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {activeTab === "info" && <ProfileForm user={user} />}
        
        {activeTab === "orders" && (
          <div className="animate-in fade-in duration-300">
            <OrderHistoryList orders={orders} />
          </div>
        )}

        {activeTab === "loyalty" && (
          <div className="animate-in fade-in duration-300">
            <LoyaltyHistoryView />
          </div>
        )}
      </div>
    </div>
  );
}
