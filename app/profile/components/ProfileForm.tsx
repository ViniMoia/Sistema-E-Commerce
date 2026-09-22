"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { UserProfile } from "../types";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, Lock, ShieldCheck } from "lucide-react";

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

      const successMsg = "Suas informações foram atualizadas com sucesso!";
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
    <form onSubmit={handleSubmit} className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Informações Pessoais</h2>
          <p className="text-sm text-zinc-400">
            Atualize seus dados cadastrais para agilizar suas compras e emissão de pedidos.
          </p>
        </div>
      </div>

      {/* Banner de Feedback Inline */}
      {feedback && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl border text-sm transition-all ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/40 border-red-500/30 text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nome Completo */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
            <span>Nome Completo</span>
            <span className="text-xs text-zinc-500">Obrigatório</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Seu nome completo"
            disabled={isSaving}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-all disabled:opacity-50"
          />
        </div>

        {/* E-mail (Somente Leitura) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
            <span>E-mail</span>
            <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
              <Lock className="w-3 h-3 text-zinc-500" />
              Não alterável
            </span>
          </label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full bg-white/[0.03] border border-white/5 rounded-lg px-4 py-3 text-zinc-400 cursor-not-allowed selection:bg-none"
          />
        </div>

        {/* Telefone / WhatsApp */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
            <span>Telefone / WhatsApp</span>
            <span className="text-xs text-zinc-500">Opcional</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
            disabled={isSaving}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-all disabled:opacity-50"
          />
        </div>

        {/* CPF / CNPJ */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
            <span>CPF / CNPJ</span>
            {hasExistingCpf ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Validado
              </span>
            ) : (
              <span className="text-xs text-zinc-500">Para Nota Fiscal</span>
            )}
          </label>
          <input
            type="text"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            disabled={hasExistingCpf || isSaving}
            placeholder={hasExistingCpf ? user.cpfCnpj! : "000.000.000-00"}
            className={`w-full rounded-lg px-4 py-3 transition-all ${
              hasExistingCpf
                ? "bg-white/[0.03] border border-white/5 text-zinc-400 cursor-not-allowed"
                : "bg-black/40 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] disabled:opacity-50"
            }`}
          />
        </div>
      </div>

      <div className="pt-4 flex items-center gap-4">
        <button
          type="submit"
          disabled={isSaving || !name.trim()}
          className="inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-black font-semibold px-8 py-3 rounded-lg hover:bg-[var(--primary)]/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-[var(--primary)]/10"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Salvando...</span>
            </>
          ) : (
            <span>Salvar Alterações</span>
          )}
        </button>

        <span className="text-xs text-zinc-500">
          Suas informações são armazenadas de forma segura e criptografada.
        </span>
      </div>
    </form>
  );
}
