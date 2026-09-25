"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContinentalLogo } from "@/components/brand/ContinentalLogo";
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

type RegisterDTO = {
  name: string;
  email: string;
  password: string;
  phone: string;
  address: {
    cep: string;
    state: string; // Requerido pelo backend
    city: string;
    district: string;
    street: string;
    number: string;
    complement?: string;
  };
};

export function RegisterForm() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    cep: "",
    state: "",
    city: "",
    district: "",
    street: "",
    number: "",
    complement: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Limpa a mensagem de erro específica quando o usuário volta a digitar
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    // Limpa o erro geral da API se o usuário modificar os dados
    if (apiError) setApiError("");
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const requiredFields = [
      "name", "email", "password", "phone", 
      "cep", "state", "city", "district", "street", "number"
    ];

    requiredFields.forEach((field) => {
      if (!formData[field as keyof typeof formData] || formData[field as keyof typeof formData].trim() === "") {
        newErrors[field] = "Campo obrigatório";
      }
    });

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "E-mail inválido";
    }
    
    if (formData.password && formData.password.length < 6) {
      newErrors.password = "A senha deve ter no mínimo 6 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    
    if (!validate()) {
      setApiError("Por favor, preencha todos os campos obrigatórios corretamente.");
      return;
    }

    setIsLoading(true);

    const dataToSend: RegisterDTO = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      address: {
        cep: formData.cep,
        state: formData.state,
        city: formData.city,
        district: formData.district,
        street: formData.street,
        number: formData.number,
        complement: formData.complement || undefined,
      },
    };

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });
      
      if (!response.ok) {
        let errorMessage = "Ocorreu um erro ao realizar o cadastro.";
        try {
          const errorData = await response.json();
          errorMessage = typeof errorData === 'string' ? errorData : (errorData?.message || errorMessage);
        } catch {
          // Se não conseguir parsear o JSON, mantém a mensagem padrão
        }
        throw new Error(errorMessage);
      }
      
      // Segurança: Limpar a senha do frontend imediatamente após sucesso
      setFormData(prev => ({ ...prev, password: "" }));
      setIsSuccess(true);
      
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 2000);
      
    } catch (error: any) {
      console.error("Erro ao registrar:", error);
      setApiError(error.message || "Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const getInputClassName = (fieldName: string) => {
    const hasError = !!errors[fieldName];
    const base = "w-full bg-[#0B132B]/70 text-white placeholder-gray-400 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all";
    if (hasError) {
      return `${base} border border-red-500/70 focus:border-red-500 focus:ring-1 focus:ring-red-500`;
    }
    return `${base} border border-catalog-gold/30 focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold`;
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md mx-auto bg-catalog-card border border-catalog-gold/45 rounded-[2rem] p-8 md:p-10 shadow-2xl backdrop-blur-2xl relative z-10 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-catalog-gold/15 border border-catalog-gold/50 flex items-center justify-center mx-auto text-catalog-gold shadow-[0_0_20px_rgba(240,180,14,0.25)]">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-[10px] text-catalog-gold uppercase tracking-[0.25em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded inline-block bg-catalog-gold/5">
            Conta Criada
          </span>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight">
            Cadastro Concluído!
          </h2>
          <p className="text-sm text-catalog-muted font-light leading-relaxed">
            Seja bem-vindo à Continental. Sua conta foi criada com sucesso.
          </p>
          <p className="text-xs font-mono text-catalog-gold pt-2 flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Redirecionando para a loja...
          </p>
        </div>
        <div className="pt-2">
          <Link href="/">
            <button className="btn-shimmer w-full py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs tracking-widest uppercase shadow-md hover:shadow-lg transition-all border border-[#F5BD1E]/40 cursor-pointer">
              Ir para a Loja Agora
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Botão de Retorno / Voltar às Compras */}
      <Link
        href="/"
        className="inline-flex items-center text-catalog-muted hover:text-white transition-colors group w-fit cursor-pointer"
      >
        <span className="group-hover:-translate-x-1 transition-transform duration-300">
          <ArrowLeft className="w-4 h-4 text-catalog-gold" />
        </span>
        <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
          Voltar às compras
        </span>
      </Link>

      <div className="w-full bg-catalog-card border border-catalog-gold/45 rounded-[2rem] p-8 md:p-10 shadow-2xl backdrop-blur-2xl relative z-10 transition-all">
      {/* Identidade Visual no Topo do Formulário */}
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="mb-4">
          <ContinentalLogo variant="symbol" className="h-12 w-auto" />
        </div>
        <span className="text-[10px] text-catalog-gold uppercase tracking-[0.25em] font-mono font-bold border border-catalog-gold/45 px-2.5 py-1 rounded mb-3 inline-block bg-catalog-gold/5">
          Novo Cadastro
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight uppercase">
          Crie sua Conta
        </h2>
        <p className="text-sm text-catalog-muted font-light mt-1">
          Preencha os dados abaixo para ter acesso à linha exclusiva Continental
        </p>
      </div>

      {apiError && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center justify-center gap-2 text-center">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <p className="text-red-400 text-xs font-mono">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados Pessoais */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase border-b border-catalog-gold/20 pb-2">
            Dados Pessoais
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Nome Completo
              </label>
              <input 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="Ex: João da Silva"
                className={getInputClassName("name")}
              />
              {errors.name && <p className="text-red-400 text-[11px] font-mono mt-1">{errors.name}</p>}
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                E-mail
              </label>
              <input 
                id="email" 
                name="email" 
                type="email" 
                value={formData.email} 
                onChange={handleChange} 
                placeholder="joao@exemplo.com"
                className={getInputClassName("email")}
              />
              {errors.email && <p className="text-red-400 text-[11px] font-mono mt-1">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Senha
              </label>
              <input 
                id="password" 
                name="password" 
                type="password" 
                value={formData.password} 
                onChange={handleChange} 
                placeholder="Mínimo 6 caracteres"
                className={getInputClassName("password")}
              />
              {errors.password && <p className="text-red-400 text-[11px] font-mono mt-1">{errors.password}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Telefone (com DDD)
              </label>
              <input 
                id="phone" 
                name="phone" 
                value={formData.phone} 
                onChange={handleChange} 
                placeholder="(00) 00000-0000"
                className={getInputClassName("phone")}
              />
              {errors.phone && <p className="text-red-400 text-[11px] font-mono mt-1">{errors.phone}</p>}
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase border-b border-catalog-gold/20 pb-2 pt-2">
            Endereço de Entrega
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 md:col-span-1">
              <label htmlFor="cep" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                CEP
              </label>
              <input 
                id="cep" 
                name="cep" 
                value={formData.cep} 
                onChange={handleChange} 
                placeholder="00000-000"
                className={getInputClassName("cep")}
              />
              {errors.cep && <p className="text-red-400 text-[11px] font-mono mt-1">{errors.cep}</p>}
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <label htmlFor="state" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                UF (Estado)
              </label>
              <input 
                id="state" 
                name="state" 
                value={formData.state} 
                onChange={handleChange} 
                placeholder="SP"
                maxLength={2}
                className={getInputClassName("state")}
              />
              {errors.state && <p className="text-red-400 text-[11px] font-mono mt-1">{errors.state}</p>}
            </div>
            
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="city" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Cidade
              </label>
              <input 
                id="city" 
                name="city" 
                value={formData.city} 
                onChange={handleChange} 
                placeholder="Sua cidade"
                className={getInputClassName("city")}
              />
              {errors.city && <p className="text-red-400 text-[11px] font-mono mt-1">{errors.city}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="district" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Bairro
              </label>
              <input 
                id="district" 
                name="district" 
                value={formData.district} 
                onChange={handleChange} 
                placeholder="Seu bairro"
                className={getInputClassName("district")}
              />
              {errors.district && <p className="text-red-400 text-[11px] font-mono mt-1">{errors.district}</p>}
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="street" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Rua / Logradouro
              </label>
              <input 
                id="street" 
                name="street" 
                value={formData.street} 
                onChange={handleChange} 
                placeholder="Nome da sua rua"
                className={getInputClassName("street")}
              />
              {errors.street && <p className="text-red-400 text-[11px] font-mono mt-1">{errors.street}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-1">
              <label htmlFor="number" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Número
              </label>
              <input 
                id="number" 
                name="number" 
                value={formData.number} 
                onChange={handleChange} 
                placeholder="123"
                className={getInputClassName("number")}
              />
              {errors.number && <p className="text-red-400 text-[11px] font-mono mt-1">{errors.number}</p>}
            </div>
            
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="complement" className="block text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase">
                Complemento (opcional)
              </label>
              <input 
                id="complement" 
                name="complement" 
                value={formData.complement} 
                onChange={handleChange} 
                placeholder="Apto, Bloco, etc."
                className={getInputClassName("complement")}
              />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button 
            type="submit" 
            disabled={isLoading}
            className="btn-shimmer w-full py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] hover:from-[#F5BD1E] hover:to-[#F0B40E] text-[#010E31] font-bold text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] hover:shadow-[0_0_35px_rgba(240,180,14,0.6)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border border-[#F5BD1E]/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-[#010E31]/30 border-t-[#010E31] animate-spin"></span>
                Processando Cadastro...
              </span>
            ) : (
              "Finalizar Cadastro"
            )}
          </button>
        </div>

        <div className="mt-8 text-center text-xs font-mono text-catalog-muted">
          Já possui uma conta?{" "}
          <Link href="/login" className="text-catalog-gold font-bold hover:underline ml-1">
            Acessar Conta
          </Link>
        </div>
      </form>
      </div>
    </div>
  );
}
