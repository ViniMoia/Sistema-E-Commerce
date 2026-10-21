"use client";

import { useId, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { externalImageUrlSchema } from "@/lib/validators/image-url";

interface ProductImageUrlProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export function ProductImageUrl({ value, onChange, label = "Imagem do produto" }: ProductImageUrlProps) {
  const id = useId();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const preview = externalImageUrlSchema.safeParse(value).success && value !== failedUrl;

  return (
    <div className="space-y-4 min-w-0">
      <label htmlFor={id} className="block text-xs font-mono font-bold text-catalog-gold">
        {label} — URL externa
      </label>
      <input
        id={id}
        type="url"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="https://..."
        aria-describedby={`${id}-help`}
        className="w-full min-w-0 bg-[#0B132B]/70 border border-catalog-gold/30 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-catalog-gold"
      />
      <p id={`${id}-help`} className="text-xs text-catalog-muted">
        Utilize o endereço da imagem importada da Nuvemshop. Não é permitido enviar arquivos.
      </p>
      <div className="w-28 h-28 bg-white rounded-2xl p-2.5 border border-catalog-gold/40 flex items-center justify-center overflow-hidden">
        {preview ? (
          // External catalog URLs are preserved; there is no upload or image copy.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Prévia do produto" className="w-full h-full object-contain" onError={() => setFailedUrl(value)} />
        ) : (
          <ImageIcon className="w-8 h-8 text-slate-400" aria-label="Imagem indisponível" />
        )}
      </div>
    </div>
  );
}
