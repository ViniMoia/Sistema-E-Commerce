import { Badge } from "@/components/ui/badge";
import { ShieldAlert, User } from "lucide-react";

interface UserRoleBadgeProps {
  role: "ADMIN" | "CUSTOMER";
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  if (role === "ADMIN") {
    return (
      <Badge 
        className="bg-neutral-800 text-white hover:bg-neutral-700 ring-1 ring-white/10 border-0 gap-1.5 py-1 px-3 shadow-none transition-colors"
      >
        <ShieldAlert className="w-3.5 h-3.5" />
        Admin
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className="text-neutral-400 border-white/10 gap-1.5 py-1 px-3 hover:bg-white/5 transition-colors"
    >
      <User className="w-3.5 h-3.5" />
      Cliente
    </Badge>
  );
}
