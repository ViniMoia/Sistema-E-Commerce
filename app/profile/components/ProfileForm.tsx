"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { UserProfile } from "../types";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, Lock, ShieldCheck, UserCheck, Save } from "lucide-react";

export function ProfileForm({ user }: { user: UserProfile }) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [cpfCnpj, setCpfCnpj] = useState(user.cpfCnpj || "");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const hasExistingCpf = Boolean(user.cpfCnpj && user.cpfCnpj.trim() !== "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    // Validação básica do lado do cliente
    if (!name.trim() || name.trim().length < 2) {
      const errText = "O nome deve ter pelo menos 2 caracteres.";
      setFeedback({ type: "error", message: errText });
      toast({
        title: "Nome inválido",
        description: errText,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const payload: { name: string; phone?: string; cpfCnpj?: string } = {
        name: name.trim(),
        phone: phone.trim() || undefined,
      };

      // Só envia CPF/CNPJ se o usuário não possuía um previamente cadastrado
      if (!hasExistingCpf && cpfCnpj.trim()) {
        payload.cpfCnpj = cpfCnpj.trim();
      }

      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Não foi possível salvar as alterações.");
      }

      const successMsg = "Suas informações cadastrais foram atualizadas com sucesso!";
      setFeedback({ type: "success", message: successMsg });
      toast({
        title: "Perfil atualizado",
        description: successMsg,
      });

      // Atualiza o estado da página sem recarregar totalmente
      router.refresh();
    } catch (err: any) {
      const errMsg = err.message || "Erro inesperado ao salvar perfil.";
      setFeedback({ type: "error", message: errMsg });
      toast({
        title: "Erro ao atualizar",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-catalog-gold/20 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-continental-display text-white tracking-tight">
            Informações Pessoais
          </h2>
          <p className="text-xs text-catalog-muted font-light mt-0.5">
            Atualize seus dados cadastrais para agilizar suas compras e emissão de notas fiscais.
          </p>
        </div>
      </div>

      {/* Banner de Feedback Inline */}
      {feedback && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl border text-xs font-mono transition-all ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-red-950/40 border-red-500/40 text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nome Completo */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center justify-between">
            <span>Nome Completo</span>
            <span className="text-[10px] text-catalog-muted font-normal">Obrigatório</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Seu nome completo"
            disabled={isSaving}
            className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner disabled:opacity-50"
          />
        </div>

        {/* E-mail (Somente Leitura) */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center justify-between">
            <span>E-mail</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-normal">
              <Lock className="w-3 h-3 text-catalog-gold/60" />
              Não alterável
            </span>
          </label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full h-11 px-4 rounded-xl border border-white/5 bg-[#050B14] text-xs font-mono text-neutral-400 cursor-not-allowed selection:bg-none"
          />
        </div>

        {/* Telefone / WhatsApp */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center justify-between">
            <span>Telefone / WhatsApp</span>
            <span className="text-[10px] text-catalog-muted font-normal">Opcional</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
            disabled={isSaving}
            className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner disabled:opacity-50"
          />
        </div>

        {/* CPF / CNPJ */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center justify-between">
            <span>CPF / CNPJ</span>
            {hasExistingCpf ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Validado
              </span>
            ) : (
              <span className="text-[10px] text-catalog-muted font-normal">Para Emissão Fiscal</span>
            )}
          </label>
          <input
            type="text"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            disabled={hasExistingCpf || isSaving}
            placeholder={hasExistingCpf ? user.cpfCnpj! : "000.000.000-00"}
            className={`w-full h-11 px-4 rounded-xl text-xs font-mono transition-all ${
              hasExistingCpf
                ? "border border-white/5 bg-[#050B14] text-neutral-400 cursor-not-allowed"
                : "border border-catalog-gold/30 bg-[#0B132B]/80 text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 shadow-inner disabled:opacity-50"
            }`}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-catalog-gold/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="submit"
          disabled={isSaving || !name.trim()}
          className="btn-shimmer inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#DDAF02] text-black font-bold uppercase font-mono tracking-wider px-8 py-3.5 shadow-[0_0_20px_rgba(240,180,14,0.3)] hover:shadow-[0_0_30px_rgba(240,180,14,0.5)] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Salvando Alterações...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-black" />
              <span>Salvar Alterações</span>
            </>
          )}
        </button>

        <span className="text-[11px] font-mono text-catalog-muted">
          Suas informações são armazenadas com segurança e criptografia.
        </span>
      </div>
    </form>
  );
}
