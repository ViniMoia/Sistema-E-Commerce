"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, Loader2, X, Link as LinkIcon, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
}

export function ProductImageUpload({
  value,
  onChange,
  label = "Imagem do Produto",
  className = "",
}: ProductImageUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Apenas imagens JPG, PNG, WEBP ou GIF são aceitas.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem não pode ultrapassar 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "products");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Falha no upload da imagem");
      }

      onChange(result.data.url);
      toast({
        title: "Upload concluído",
        description: "Imagem vinculada com sucesso ao produto.",
      });
    } catch (err: any) {
      toast({
        title: "Upload indisponível",
        description: err.message || "Utilize o campo de URL externa para vincular a imagem.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Campo prioritário: Inserir URL manual */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-catalog-gold" />
            {label} (URL da Imagem / CDN Externa)
          </span>
          <span className="text-[10px] text-catalog-muted lowercase font-light">jpg, png, webp</span>
        </label>
        <div className="relative">
          <input
            type="url"
            placeholder="https://... ou cole a URL direta da foto"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[#0B132B]/70 border border-catalog-gold/30 text-white placeholder-gray-500 text-xs sm:text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold font-mono transition-all"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-catalog-muted hover:text-white p-1"
              title="Limpar imagem"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Grid de Upload e Pré-Visualização com Palco Branco */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        {/* Dropzone / Botão de Selecionar Arquivo Local (7 Colunas) */}
        <div className="sm:col-span-7">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-5 rounded-2xl border-2 border-dashed border-catalog-gold/30 bg-[#0B132B]/40 hover:bg-[#0B132B]/70 hover:border-catalog-gold cursor-pointer transition-all flex flex-col items-center justify-center text-center space-y-2 group"
          >
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-catalog-gold" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold group-hover:scale-110 transition-transform">
                <UploadCloud className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                {isUploading ? "Enviando arquivo..." : "Fazer Upload de Foto Local"}
              </p>
              <p className="text-[11px] text-catalog-muted font-light mt-0.5">
                PNG, JPG ou WEBP de até 5MB
              </p>
            </div>
          </div>
        </div>

        {/* Palco Branco de Pré-Visualização Obrigatório (5 Colunas) */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="w-28 h-28 bg-white rounded-2xl p-2.5 shadow-xl border-2 border-catalog-gold/40 flex items-center justify-center relative overflow-hidden">
            {value ? (
              <img
                src={value}
                alt="Prévia do Produto"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "https://placehold.co/200x200/png?text=Imagem+Inv%C3%A1lida";
                }}
              />
            ) : (
              <div className="text-center text-slate-400 space-y-1">
                <ImageIcon className="w-8 h-8 mx-auto opacity-40 text-slate-600" />
                <span className="text-[10px] font-mono text-slate-500 uppercase block font-semibold">
                  Palco Branco
                </span>
              </div>
            )}
          </div>
          <span className="text-[10px] font-mono text-catalog-muted uppercase tracking-wider mt-2">
            Pré-visualização Canônica
          </span>
        </div>
      </div>
    </div>
  );
}
