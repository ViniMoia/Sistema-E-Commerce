"use client";

import React, { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ContinentalLogo } from "@/components/brand/ContinentalLogo";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!token || token.trim().length < 10) {
    return (
      <div className="w-full max-w-md mx-auto bg-catalog-card border border-catalog-gold/45 rounded-[2rem] p-8 md:p-10 shadow-2xl backdrop-blur-2xl relative z-10 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <span className="text-[10px] text-red-400 uppercase tracking-[0.25em] font-mono font-bold border border-red-500/40 px-2.5 py-1 rounded mb-3 inline-block bg-red-950/20">
            Código Inválido
          </span>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight mb-2">Link Expirado ou Incompleto</h2>
          <p className="text-catalog-muted text-sm font-light leading-relaxed">
            Não encontramos um código de recuperação válido no link acessado. O link pode ter sido copiado incorretamente ou expirou.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/forgot-password">
            <button className="btn-shimmer w-full py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs tracking-widest uppercase shadow-[0_0_20px_rgba(240,180,14,0.3)] border border-[#F5BD1E]/40">
              Solicitar Novo Link
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 6) {
      setErrorMessage("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas informadas não coincidem.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao redefinir a senha.");
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Ocorreu um erro ao processar sua nova senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-catalog-card border border-catalog-gold/45 rounded-[2rem] p-8 md:p-10 shadow-2xl backdrop-blur-2xl relative z-10 transition-all">
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="mb-4">
          <ContinentalLogo variant="symbol" className="h-12 w-auto" />
        </div>
        <span className="text-[10px] text-catalog-gold uppercase tracking-[0.25em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded mb-3 inline-block bg-catalog-gold/5">
          Nova Senha
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight uppercase">
          Criar Nova Senha
        </h2>
        <p className="text-sm text-catalog-muted font-light mt-1">
          Escolha uma senha forte para proteger sua conta
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl text-red-400 text-xs font-mono text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isSuccess ? (
        <div className="text-center py-2 space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Senha alterada com sucesso!</h3>
            <p className="text-sm text-slate-300 font-light leading-relaxed">
              Sua nova senha foi atualizada no sistema e suas sessões antigas foram encerradas com segurança.
            </p>
            <p className="text-catalog-gold text-xs font-mono pt-2 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Redirecionando para o login em instantes...
            </p>
          </div>
          <div className="pt-2">
            <Link href="/login">
              <button className="btn-shimmer w-full py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs tracking-widest uppercase shadow-[0_0_20px_rgba(240,180,14,0.3)] border border-[#F5BD1E]/40">
                Acessar minha conta agora
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 pr-11 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold transition-all"
                  required
                  minLength={6}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-catalog-muted hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Confirmar Nova Senha
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold transition-all"
                required
                minLength={6}
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
                  Salvando nova senha...
                </span>
              ) : (
                "Salvar Nova Senha"
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
