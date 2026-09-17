"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";

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
    <div className="w-full max-w-md mx-auto bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-6">
        <Link
          href="/login"
          className="inline-flex items-center text-xs text-neutral-400 hover:text-white transition-colors mb-4 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:-translate-x-1" />
          Voltar para o Login
        </Link>
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">Recuperar Senha</h2>
        <p className="text-neutral-400 text-sm">
          Informe seu e-mail cadastrado para receber o link de redefinição.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
          {errorMessage}
        </div>
      )}

      {isSubmitted ? (
        <div className="text-center py-4 space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#dbb501]/10 border border-[#dbb501]/30 flex items-center justify-center mx-auto text-[#dbb501]">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Instruções enviadas!</h3>
            <p className="text-neutral-300 text-sm leading-relaxed">
              Se o endereço <span className="text-[#dbb501] font-medium">{email}</span> estiver cadastrado em nossa loja, enviamos um link para você cadastrar uma nova senha.
            </p>
            <p className="text-neutral-500 text-xs mt-2">
              Não se esqueça de verificar também sua caixa de <strong>Spam</strong> ou <strong>Lixo Eletrônico</strong>.
            </p>
          </div>

          <div className="pt-4">
            <Button
              variant="outline"
              onClick={() => setIsSubmitted(false)}
              className="border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800"
            >
              Enviar para outro e-mail
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-neutral-200">
              E-mail da sua conta
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@exemplo.com"
                className="pl-9 bg-neutral-950/50 border-neutral-800 text-white placeholder:text-neutral-500 focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501] transition-all"
                required
                autoFocus
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#dbb501] hover:bg-[#c9a601] text-black font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-[#dbb501]/10 flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando solicitação...
              </>
            ) : (
              "Enviar link de recuperação"
            )}
          </Button>

          <div className="text-center pt-2">
            <span className="text-xs text-neutral-400">
              Lembrou sua senha?{" "}
              <Link href="/login" className="text-[#dbb501] hover:underline font-medium">
                Faça login
              </Link>
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
