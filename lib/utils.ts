import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOptimizedImageUrl(url: string, width: number, height?: number): string {
  if (!url) return "";
  
  // Se for uma URL do Supabase Storage, converte para usar a API de Transformação/Redimensionamento
  if (url.includes(".supabase.co/storage/v1/object/public/")) {
    const transformedUrl = url.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/cop/public/"
    );
    const params = new URLSearchParams();
    params.set("width", width.toString());
    if (height) params.set("height", height.toString());
    params.set("resize", "contain");
    params.set("quality", "75");
    
    return `${transformedUrl}?${params.toString()}`;
  }
  
  return url;
}
