"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, KeyRound, AlertTriangle } from "lucide-react";

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

      toast.success("Nível de acesso atualizado com sucesso");
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
        <button
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono font-semibold bg-white/5 border border-catalog-gold/30 text-white hover:text-catalog-gold hover:border-catalog-gold hover:bg-catalog-gold/10 transition-all shadow-[0_0_10px_rgba(240,180,14,0.05)] hover:shadow-[0_0_15px_rgba(240,180,14,0.25)] cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5 text-catalog-gold" />
          <span>Alterar Acesso</span>
        </button>
      </DialogTrigger>
      
      <DialogContent className="bg-[#070D18] border border-catalog-gold/30 text-white rounded-2xl shadow-2xl p-6 max-w-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5 text-catalog-gold">
            <div className="w-8 h-8 rounded-lg bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <DialogTitle className="text-lg font-bold font-continental-display text-white tracking-tight">
              Gerenciar Nível de Permissão
            </DialogTitle>
          </div>
          <p className="text-xs text-catalog-muted font-mono">
            Usuário: <span className="text-catalog-gold font-bold">{user.name}</span>
          </p>
        </DialogHeader>
        
        <div className="py-4 space-y-5">
          {/* Alerta de Segurança */}
          <div className="p-3.5 rounded-xl bg-[#050B14] border border-catalog-gold/20 flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-catalog-gold shrink-0 mt-0.5" />
            <p className="text-catalog-muted leading-relaxed">
              Administradores possuem acesso total ao catálogo de produtos, pedidos, clientes e configurações fiscais/PIX da loja.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-mono uppercase tracking-wider text-catalog-gold font-semibold">
              Selecione o Nível de Acesso
            </label>
            <Select value={role} onValueChange={(val) => setRole(val as "ADMIN" | "CUSTOMER")}>
              <SelectTrigger className="w-full h-11 bg-[#050B14] border border-catalog-gold/30 rounded-xl text-white font-mono text-xs focus:ring-1 focus:ring-catalog-gold">
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent className="bg-[#070D18] border border-catalog-gold/30 text-white rounded-xl shadow-xl">
                <SelectItem
                  value="CUSTOMER"
                  className="hover:bg-catalog-gold/10 focus:bg-catalog-gold/10 cursor-pointer font-mono text-xs text-neutral-200"
                >
                  <div className="flex items-center gap-2 py-1">
                    <span className="font-semibold text-white">Cliente</span>
                    <span className="text-neutral-400 text-[10px]">(Acesso padrão de compras)</span>
                  </div>
                </SelectItem>
                <SelectItem
                  value="ADMIN"
                  className="hover:bg-catalog-gold/10 focus:bg-catalog-gold/10 cursor-pointer font-mono text-xs text-neutral-200"
                >
                  <div className="flex items-center gap-2 py-1">
                    <span className="font-bold text-catalog-gold">Administrador</span>
                    <span className="text-neutral-400 text-[10px]">(Controle total da loja)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <button
            onClick={onSubmit} 
            disabled={isLoading || role === user.role} 
            className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#DDAF02] text-black font-bold text-xs uppercase font-mono tracking-wider py-3 shadow-[0_0_20px_rgba(240,180,14,0.25)] hover:shadow-[0_0_30px_rgba(240,180,14,0.45)] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-black" />}
            <span>Confirmar Alteração</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
