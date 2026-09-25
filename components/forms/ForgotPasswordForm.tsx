"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ContinentalLogo } from "@/components/brand/ContinentalLogo";
import { ArrowLeft, CheckCircle2, Loader2, Mail, AlertCircle } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMessage("Por favor, insira um e-mail válido.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Não foi possível processar a solicitação.");
      }

      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-catalog-card border border-catalog-gold/45 rounded-[2rem] p-8 md:p-10 shadow-2xl backdrop-blur-2xl relative z-10 transition-all">
      <Link
        href="/login"
        className="inline-flex items-center text-catalog-muted hover:text-white transition-colors group w-fit cursor-pointer mb-6"
      >
        <span className="group-hover:-translate-x-1 transition-transform duration-300">
          <ArrowLeft className="w-4 h-4 text-catalog-gold" />
        </span>
        <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
          Voltar ao Login
        </span>
      </Link>

      <div className="mb-8 text-center flex flex-col items-center">
        <div className="mb-4">
          <ContinentalLogo variant="symbol" className="h-12 w-auto" />
        </div>
        <span className="text-[10px] text-catalog-gold uppercase tracking-[0.25em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded mb-3 inline-block bg-catalog-gold/5">
          Recuperação de Acesso
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight uppercase">
          Recuperar Senha
        </h2>
        <p className="text-sm text-catalog-muted font-light mt-1">
          Informe seu e-mail cadastrado para receber o link de redefinição
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl text-red-400 text-xs font-mono text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isSubmitted ? (
        <div className="text-center py-2 space-y-6">
          <div className="w-16 h-16 rounded-full bg-catalog-gold/15 border border-catalog-gold/50 flex items-center justify-center mx-auto text-catalog-gold shadow-[0_0_20px_rgba(240,180,14,0.25)]">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Instruções enviadas!</h3>
            <p className="text-sm text-slate-300 font-light leading-relaxed">
              Se o endereço <span className="text-catalog-gold font-mono font-semibold">{email}</span> estiver cadastrado em nossa loja, enviamos um link para você redefinir sua senha.
            </p>
            <p className="text-xs font-mono text-catalog-muted mt-2">
              Verifique também sua caixa de Spam ou Lixo Eletrônico.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setIsSubmitted(false)}
              className="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs tracking-widest uppercase border border-white/10 hover:border-white/20 backdrop-blur-md transition-all cursor-pointer"
            >
              Enviar para outro e-mail
            </button>
            <Link href="/login">
              <button className="btn-shimmer w-full py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs tracking-widest uppercase shadow-[0_0_20px_rgba(240,180,14,0.3)] border border-[#F5BD1E]/40">
                Retornar ao Login
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
              E-mail da sua conta
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-catalog-gold/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold transition-all"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-shimmer w-full py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] hover:from-[#F5BD1E] hover:to-[#F0B40E] text-[#010E31] font-bold text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] hover:shadow-[0_0_35px_rgba(240,180,14,0.6)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border border-[#F5BD1E]/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-[#010E31]/30 border-t-[#010E31] animate-spin"></span>
                  Processando envio...
                </span>
              ) : (
                "Enviar link de recuperação"
              )}
            </button>
          </div>

          <div className="mt-8 text-center text-xs font-mono text-catalog-muted">
            Lembrou sua senha?{" "}
            <Link href="/login" className="text-catalog-gold font-bold hover:underline ml-1">
              Fazer Login
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
