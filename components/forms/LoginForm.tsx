"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContinentalLogo } from "@/components/brand/ContinentalLogo";
import { loginSchema, LoginInput } from "@/lib/validators/auth";
import { AlertCircle } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginInput>({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Client-side validation with Zod
    const validation = loginSchema.safeParse(formData);
    
    if (!validation.success) {
      setError("Por favor, preencha os dados corretamente.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao fazer login");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-catalog-card border border-catalog-gold/45 rounded-[2rem] p-8 md:p-10 shadow-2xl backdrop-blur-2xl relative z-10 transition-all">
      {/* Identidade Visual no Topo do Formulário */}
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="mb-4">
          <ContinentalLogo variant="symbol" className="h-12 w-auto" />
        </div>
        <span className="text-[10px] text-catalog-gold uppercase tracking-[0.25em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded mb-3 inline-block bg-catalog-gold/5">
          Autenticação Segura
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight uppercase">
          Acessar Conta
        </h2>
        <p className="text-sm text-catalog-muted font-light mt-1">
          Insira suas credenciais para entrar
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl text-red-400 text-xs font-mono text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label 
              htmlFor="email" 
              className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase"
            >
              E-mail de Acesso
            </label>
            <input 
              id="email" 
              name="email" 
              type="email" 
              value={formData.email} 
              onChange={handleChange} 
              placeholder="seu.email@exemplo.com"
              className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold transition-all"
              required
              autoComplete="email"
            />
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label 
                htmlFor="password" 
                className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase"
              >
                Senha
              </label>
              <Link 
                href="/forgot-password" 
                className="text-xs font-mono text-catalog-gold hover:text-white underline transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <input 
              id="password" 
              name="password" 
              type="password" 
              value={formData.password} 
              onChange={handleChange} 
              placeholder="Sua senha de acesso"
              className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold transition-all"
              required
              autoComplete="current-password"
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
                Acessando...
              </span>
            ) : (
              "Entrar na Conta"
            )}
          </button>
        </div>

        <div className="mt-8 text-center text-xs font-mono text-catalog-muted">
          Ainda não tem uma conta?{" "}
          <Link href="/register" className="text-catalog-gold font-bold hover:underline ml-1">
            Criar Conta
          </Link>
        </div>
      </form>
    </div>
  );
}
