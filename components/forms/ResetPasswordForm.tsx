"use client";

import React, { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

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
      <div className="w-full max-w-md mx-auto bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Link Inválido ou Incompleto</h2>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Não encontramos um código de recuperação válido no link acessado. O link pode ter sido copiado incorretamente ou expirou.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/forgot-password">
            <Button className="w-full bg-[#dbb501] hover:bg-[#c9a601] text-black font-semibold">
              Solicitar novo link de recuperação
            </Button>
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
      }, 3500);
    } catch (err: any) {
      setErrorMessage(err.message || "Ocorreu um erro ao processar sua nova senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#dbb501]/10 border border-[#dbb501]/30 flex items-center justify-center mx-auto text-[#dbb501] mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">Criar Nova Senha</h2>
        <p className="text-neutral-400 text-sm">
          Escolha uma senha forte para proteger o acesso à sua conta.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
          {errorMessage}
        </div>
      )}

      {isSuccess ? (
        <div className="text-center py-4 space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Senha alterada com sucesso!</h3>
            <p className="text-neutral-300 text-sm leading-relaxed">
              Sua nova senha foi atualizada no sistema e suas sessões antigas foram encerradas com segurança.
            </p>
            <p className="text-[#dbb501] text-xs pt-2 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Redirecionando para o login em instantes...
            </p>
          </div>
          <div className="pt-3">
            <Link href="/login">
              <Button className="w-full bg-[#dbb501] hover:bg-[#c9a601] text-black font-semibold">
                Acessar minha conta agora
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-neutral-200">
              Nova Senha
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="pr-10 bg-neutral-950/50 border-neutral-800 text-white placeholder:text-neutral-500 focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501] transition-all"
                required
                minLength={6}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm text-neutral-200">
              Confirmar Nova Senha
            </Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite a senha novamente"
              className="bg-neutral-950/50 border-neutral-800 text-white placeholder:text-neutral-500 focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501] transition-all"
              required
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#dbb501] hover:bg-[#c9a601] text-black font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-[#dbb501]/10 flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Atualizando credenciais...
              </>
            ) : (
              "Redefinir e Salvar Senha"
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
