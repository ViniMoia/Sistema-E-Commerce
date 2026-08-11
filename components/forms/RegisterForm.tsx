"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

type RegisterDTO = {
  name: string;
  email: string;
  password: string;
  phone: string;
  lojaID: string; // Requerido pelo schema/backend
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
      // Passando um lojaID padrão. No futuro, isso pode vir do subdomínio ou contexto da loja.
      lojaID: "loja-padrao-id", 
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
          // Como no route.ts estamos retornando Response.json(error.message, { status: 400 })
          errorMessage = typeof errorData === 'string' ? errorData : (errorData?.message || errorMessage);
        } catch {
          // Se não conseguir parsear o JSON, mantém a mensagem padrão
        }
        throw new Error(errorMessage);
      }
      
      // Segurança: Limpar a senha do frontend imediatamente após sucesso
      setFormData(prev => ({ ...prev, password: "" }));
      
      alert("Cadastro realizado com sucesso!");
      
      // Redireciona o usuário (Ex: para a tela de login ou direto para dashboard)
      router.push("/login");
      
    } catch (error: any) {
      console.error("Erro ao registrar:", error);
      setApiError(error.message || "Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Crie sua conta</h2>
        <p className="text-neutral-400 text-sm">Preencha os dados abaixo para se cadastrar</p>
      </div>

      {apiError && (
        <div className="mb-6 p-4 rounded-md bg-red-500/10 border border-red-500/50 flex items-center justify-center">
          <p className="text-red-400 text-sm font-medium text-center">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados Pessoais */}
        <div className="space-y-4">
          <h3 className="text-[#dbb501] font-mono text-xs uppercase tracking-[0.15em] border-b border-white/10 pb-2">
            Dados Pessoais
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="Ex: João da Silva"
                className={errors.name ? "border-red-500" : "focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                value={formData.email} 
                onChange={handleChange} 
                placeholder="joao@exemplo.com"
                className={errors.email ? "border-red-500" : "focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                value={formData.password} 
                onChange={handleChange} 
                placeholder="Sua senha secreta"
                className={errors.password ? "border-red-500" : "focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (com DDD)</Label>
              <Input 
                id="phone" 
                name="phone" 
                value={formData.phone} 
                onChange={handleChange} 
                placeholder="(00) 00000-0000"
                className={errors.phone ? "border-red-500" : "focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"}
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-4">
          <h3 className="text-[#dbb501] font-mono text-xs uppercase tracking-[0.15em] border-b border-white/10 pb-2 pt-4">
            Endereço
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="cep">CEP</Label>
              <Input 
                id="cep" 
                name="cep" 
                value={formData.cep} 
                onChange={handleChange} 
                placeholder="00000-000"
                className={errors.cep ? "border-red-500" : "focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"}
              />
              {errors.cep && <p className="text-red-500 text-xs mt-1">{errors.cep}</p>}
            </div>

            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="state">UF (Estado)</Label>
              <Input 
                id="state" 
                name="state" 
                value={formData.state} 
                onChange={handleChange} 
                placeholder="SP"
                maxLength={2}
                className={errors.state ? "border-red-500" : "focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"}
              />
              {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="city">Cidade</Label>
              <Input 
                id="city" 
                name="city" 
                value={formData.city} 
                onChange={handleChange} 
                placeholder="Sua cidade"
                className={errors.city ? "border-red-500" : "focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"}
              />
              {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="district">Bairro</Label>
              <Input 
                id="district" 
                name="district" 
                value={formData.district} 
                onChange={handleChange} 
                placeholder="Seu bairro"
                className={errors.district ? "border-red-500" : "focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"}
              />
              {errors.district && <p className="text-red-500 text-xs mt-1">{errors.district}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="street">Rua</Label>
              <Input 
                id="street" 
                name="street" 
                value={formData.street} 
                onChange={handleChange} 
                placeholder="Nome da sua rua"
                className={errors.street ? "border-red-500" : "focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"}
              />
              {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="number">Número</Label>
              <Input 
                id="number" 
                name="number" 
                value={formData.number} 
                onChange={handleChange} 
                placeholder="123"
                className={errors.number ? "border-red-500" : "focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"}
              />
              {errors.number && <p className="text-red-500 text-xs mt-1">{errors.number}</p>}
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="complement">Complemento (opcional)</Label>
              <Input 
                id="complement" 
                name="complement" 
                value={formData.complement} 
                onChange={handleChange} 
                placeholder="Apto, Bloco, etc."
                className="focus-visible:ring-[#dbb501] focus-visible:border-[#dbb501]"
              />
            </div>
          </div>
        </div>

        <div className="pt-6">
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3 px-4 rounded-md bg-[#dbb501] text-black font-bold tracking-widest uppercase hover:bg-[#dbb501]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(219,181,1,0.3)] hover:shadow-[0_0_25px_rgba(219,181,1,0.5)]"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin"></span>
                Processando...
              </span>
            ) : (
              "Finalizar Cadastro"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
