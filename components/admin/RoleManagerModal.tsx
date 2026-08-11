"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface User {
  id: string;
  name: string;
  role: "ADMIN" | "CUSTOMER";
}

interface RoleManagerModalProps {
  user: User;
  onSuccess: () => void;
}

export function RoleManagerModal({ user, onSuccess }: RoleManagerModalProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"ADMIN" | "CUSTOMER">(user.role);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data.error || "";
        switch (errorMsg) {
          case "LAST_ADMIN":
            throw new Error("Não é possível remover o último administrador");
          case "USER_BLOCKED":
            throw new Error("Usuário bloqueado não pode ser promovido");
          case "ROLE_ALREADY_SET":
            throw new Error("Usuário já possui este papel");
          case "CANNOT_CHANGE_OWN_ROLE":
            throw new Error("Você não pode alterar seu próprio papel");
          default:
            throw new Error("Erro ao atualizar permissão");
        }
      }

      toast.success("Permissão atualizada com sucesso");
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="relative group overflow-hidden bg-neutral-900 border border-white/10 hover:bg-neutral-800 transition-colors text-neutral-300"
        >
          <span className="relative z-10">Alterar permissão</span>
          <span className="absolute top-0 left-0 h-full w-full -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:animate-[shimmer_1.5s_infinite] group-hover:opacity-100 pointer-events-none"></span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="bg-[#050505] border border-white/10 text-[#e5e5e5] glass-panel shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-white tracking-tight font-medium">Alterar permissão de {user.name}</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 space-y-6">
          <Select value={role} onValueChange={(val) => setRole(val as "ADMIN" | "CUSTOMER")}>
            <SelectTrigger className="w-full bg-black/40 border-white/10 focus:ring-white/20 text-white">
              <SelectValue placeholder="Selecione o papel" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-950 border-white/10 text-neutral-300">
              <SelectItem value="CUSTOMER" className="hover:bg-white/10 focus:bg-white/10 cursor-pointer">Cliente</SelectItem>
              <SelectItem value="ADMIN" className="hover:bg-white/10 focus:bg-white/10 cursor-pointer">Administrador</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            onClick={onSubmit} 
            disabled={isLoading || role === user.role} 
            className="w-full bg-white text-black hover:bg-neutral-200 transition-colors font-medium rounded-none"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar alteração
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
