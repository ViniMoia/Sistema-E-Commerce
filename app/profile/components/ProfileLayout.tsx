"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Award } from "lucide-react";
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
      {/* Sidebar */}
      <div className="md:col-span-1 glass-panel rounded-2xl p-6 h-fit space-y-6">
        <AvatarManager user={user} />
        
        <div className="flex flex-col space-y-2">
          <button 
            onClick={() => setActiveTab("info")}
            className={`text-left px-4 py-2 rounded-lg transition-colors ${activeTab === "info" ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
          >
            Informações Pessoais
          </button>
          <button 
            onClick={() => setActiveTab("orders")}
            className={`text-left px-4 py-2 rounded-lg transition-colors ${activeTab === "orders" ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
          >
            Meus Pedidos
          </button>
          <button 
            onClick={() => setActiveTab("loyalty")}
            className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center justify-between ${activeTab === "loyalty" ? "bg-amber-500/15 text-amber-400 font-medium" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
          >
            <span className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Pontos & Fidelidade
            </span>
          </button>

          {/* Admin access — visible only for ADMIN role */}
          {user.role === "ADMIN" && (
            <>
              <div className="h-px bg-white/5 my-1" />
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-left text-sm text-[var(--primary)] hover:bg-[var(--primary)]/10 border border-[var(--primary)]/20 transition-colors font-medium"
              >
                <LayoutDashboard className="w-4 h-4" />
                Painel Admin
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="md:col-span-3 glass-panel rounded-2xl p-8 fade-in">
        {activeTab === "info" && <ProfileForm user={user} />}
        
        {activeTab === "orders" && (
          <div className="animate-in">
            <OrderHistoryList orders={orders} />
          </div>
        )}

        {activeTab === "loyalty" && (
          <div className="animate-in">
            <LoyaltyHistoryView />
          </div>
        )}
      </div>
    </div>
  );
}
