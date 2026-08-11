"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginSchema, LoginInput } from "@/lib/validators/auth";

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
    <div className="w-full max-w-md mx-auto bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Acessar Conta</h2>
        <p className="text-neutral-400 text-sm">Insira suas credenciais para entrar</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input 
              id="email" 
              name="email" 
              type="email" 
              value={formData.email} 
              onChange={handleChange} 
              placeholder="joao@exemplo.com"
              className="focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501] transition-all"
              required
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link 
                href="/forgot-password" 
                className="text-xs text-[#dbb501] hover:text-[#dbb501]/80 transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <Input 
              id="password" 
              name="password" 
              type="password" 
              value={formData.password} 
              onChange={handleChange} 
              placeholder="Sua senha secreta"
              className="focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501] transition-all"
              required
            />
          </div>
        </div>

        <div className="pt-2">
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3 px-4 rounded-md bg-[#dbb501] text-black font-bold tracking-widest uppercase hover:bg-[#dbb501]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(219,181,1,0.3)] hover:shadow-[0_0_25px_rgba(219,181,1,0.5)]"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin"></span>
                Entrando...
              </span>
            ) : (
              "Entrar"
            )}
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-neutral-400">
          Ainda não tem uma conta?{" "}
          <Link href="/register" className="text-[#dbb501] hover:text-[#dbb501]/80 font-medium transition-colors">
            Inscreva-se
          </Link>
        </div>
      </form>
    </div>
  );
}
