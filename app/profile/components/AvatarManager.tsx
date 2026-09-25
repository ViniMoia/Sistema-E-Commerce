"use client";

import { ShieldCheck, User } from "lucide-react";
import { UserProfile } from "../types";

interface AvatarManagerProps {
  user: UserProfile;
}

export function AvatarManager({ user }: AvatarManagerProps) {
  const avatarUrl = user.avatarImageUrl || null;
  const initials = user.name?.substring(0, 2).toUpperCase() || "CT";

  return (
    <div className="flex flex-col items-center text-center space-y-4">
      {/* Círculo do Avatar — Somente leitura com acabamento metálico suave */}
      <div className="relative select-none">
        <div className="w-24 h-24 rounded-full overflow-hidden border border-catalog-gold/40 bg-gradient-to-br from-[#0B132B] to-[#070D18] shadow-lg shadow-black/60 flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl font-bold font-continental-display text-catalog-gold tracking-wider">
              {initials}
            </span>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-bold font-continental-display text-lg text-white tracking-tight">
          {user.name}
        </h3>
        {user.role === "ADMIN" ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold bg-catalog-gold/10 text-catalog-gold border border-catalog-gold/30 mt-1.5">
            <ShieldCheck className="w-3 h-3 text-catalog-gold" />
            Administrador
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-neutral-300 border border-white/10 mt-1.5">
            <User className="w-3 h-3 text-neutral-400" />
            Cliente Continental
          </span>
        )}
      </div>
    </div>
  );
}

