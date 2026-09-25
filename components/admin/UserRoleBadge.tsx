import { ShieldCheck, User } from "lucide-react";

interface UserRoleBadgeProps {
  role: "ADMIN" | "CUSTOMER";
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  if (role === "ADMIN") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/40 shadow-[0_0_12px_rgba(240,180,14,0.2)]">
        <ShieldCheck className="w-3.5 h-3.5 text-catalog-gold" />
        Administrador
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-white/5 text-neutral-300 border border-white/10 hover:border-white/20 transition-colors">
      <User className="w-3.5 h-3.5 text-neutral-400" />
      Cliente
    </span>
  );
}
