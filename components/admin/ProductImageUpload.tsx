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
  const [showUrlInput, setShowUrlInput] = useState(true);

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
      setShowUrlInput(true);
      toast({
        title: "Upload concluído",
        description: "Imagem vinculada com sucesso.",
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
    <div className={`space-y-3 ${className}`}>
      {/* Campo prioritário: Inserir URL manual */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-[var(--primary)]" />
            URL da Imagem (CDN Nuvemshop / Externa)
          </span>
        </label>
        <Input
          type="url"
          placeholder="https://dcdn-us.mitiendanube.com/... ou https://..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs bg-black/40 border-white/10 text-white placeholder-zinc-500 focus:border-[var(--primary)]"
        />
        <p className="text-[11px] text-zinc-500">
          Cole a URL direta da foto hospedada na CDN da Nuvemshop, Cloudinary ou servidor externo.
        </p>
      </div>

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
              variant="ghost"
              size="icon"
              onClick={() => {
                onChange("");
              }}
              className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
              title="Remover imagem"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Input de arquivo invisível (mantido para compatibilidade futura com S3/R2) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp, image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />
    </div>
  );
}
