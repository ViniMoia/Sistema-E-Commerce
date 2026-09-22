"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, Loader2, X, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [showUrlInput, setShowUrlInput] = useState(!value);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be re-selected if needed
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
      setShowUrlInput(false);
      toast({
        title: "Upload concluído",
        description: "Imagem salva com sucesso no Supabase Storage.",
      });
    } catch (err: any) {
      toast({
        title: "Erro no envio",
        description: err.message || "Não foi possível enviar a imagem.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Visual Preview se houver valor */}
      {value ? (
        <div className="relative group rounded-xl border border-white/10 bg-black/40 p-2 overflow-hidden flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-900 border border-white/5 shrink-0 relative flex items-center justify-center">
            <img
              src={value}
              alt={label}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-400 truncate">{value}</p>
            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              ✓ Imagem vinculada
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-xs border-white/10 hover:border-[var(--primary)] text-zinc-300"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <UploadCloud className="w-3.5 h-3.5 mr-1" />
              )}
              Trocar
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                onChange("");
                setShowUrlInput(true);
              }}
              className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
              title="Remover imagem"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        /* Área de Upload / Seleção */
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isUploading
              ? "border-[var(--primary)]/50 bg-[var(--primary)]/5 cursor-wait"
              : "border-white/10 hover:border-[var(--primary)]/50 bg-black/30 hover:bg-black/50"
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center space-y-2 py-2">
              <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
              <p className="text-sm font-medium text-zinc-300">
                Enviando imagem para o Supabase Storage...
              </p>
              <p className="text-xs text-zinc-500">Por favor, aguarde.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--primary)] border border-white/10">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-zinc-200">
                Clique para selecionar ou arraste uma foto
              </p>
              <p className="text-xs text-zinc-500">
                PNG, JPG, WEBP ou GIF (Máx. 5MB)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Input de arquivo invisível */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp, image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {/* Opção alternativa: Inserir URL manual */}
      <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="inline-flex items-center gap-1 text-zinc-400 hover:text-[var(--primary)] transition-colors"
        >
          <LinkIcon className="w-3 h-3" />
          {showUrlInput ? "Ocultar URL manual" : "Digitar URL externa manualmente"}
        </button>
      </div>

      {showUrlInput && (
        <Input
          type="url"
          placeholder="https://exemplo.com/imagem.jpg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs bg-black/40 border-white/10 text-white placeholder-zinc-500"
        />
      )}
    </div>
  );
}
