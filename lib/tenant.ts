import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import * as React from "react";
import { unstable_cache } from "next/cache";

const cacheFn = typeof React.cache === "function" ? React.cache : ((fn: any) => fn);

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImageUrl: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  customDomain?: string | null;
  pixKey?: string | null;
  pixKeyType?: string | null;
  whatsappNumber?: string | null;
}

/**
 * Normaliza o cabeçalho Host para prevenir injeções de cabeçalho e inconsistências.
 */
export function normalizeHost(rawHost: string): string {
  if (!rawHost) return "";
  // Remover porta se presente
  let clean = rawHost.split(":")[0].trim().toLowerCase();
  // Remover ponto final se presente (trailing dot)
  if (clean.endsWith(".")) {
    clean = clean.slice(0, -1);
  }
  // Sanitizar mantendo apenas caracteres alfanuméricos, pontos e hífens
  clean = clean.replace(/[^a-z0-9.-]/g, "");
  return clean;
}

/**
 * Consulta de loja em cache pelo slug ou domínio customizado
 */
const getCachedLojaBySlugOrDomain = unstable_cache(
  async (cleanHost: string) => {
    return await prisma.loja.findFirst({
      where: {
        OR: [
          { slug: cleanHost },
          { customDomain: cleanHost },
        ],
      },
    });
  },
  ["tenant-by-host-or-domain"],
  {
    revalidate: 300, // 5 minutos
    tags: ["tenant-settings"],
  }
);

/**
 * Consulta de loja em cache por slug
 */
const getCachedLojaBySlug = unstable_cache(
  async (slug: string) => {
    return await prisma.loja.findUnique({
      where: { slug },
    });
  },
  ["tenant-by-slug"],
  {
    revalidate: 300, // 5 minutos
    tags: ["tenant-settings"],
  }
);

/**
 * Resolve o tenant ativo a partir dos cabeçalhos HTTP da requisição.
 * COMPORTAMENTO FAIL-CLOSED (Finding TEN-003):
 * - Em desenvolvimento local (localhost/127.0.0.1), permite fallback para DEFAULT_LOJA_SLUG.
 * - Em produção, resolve exclusivamente por subdomínio da plataforma, Vercel ou customDomain verificado.
 * - Se o domínio/host não corresponder a nenhuma loja cadastrada, retorna null (404 Not Found),
 *   proibindo categoricamente qualquer fallback permissivo para primeira linha aleatória do banco.
 */
export const getLojaFromHeaders = cacheFn(async (): Promise<TenantContext | null> => {
  try {
    const headersList = await headers();
    const rawHost = headersList.get("x-forwarded-host") || headersList.get("host") || "";
    const cleanHost = normalizeHost(rawHost);

    if (!cleanHost) {
      return null;
    }

    // 1. Ambiente de desenvolvimento local
    if (
      cleanHost === "localhost" ||
      cleanHost === "127.0.0.1"
    ) {
      const defaultSlug =
        process.env.DEFAULT_LOJA_SLUG ||
        process.env.NEXT_PUBLIC_DEFAULT_LOJA_SLUG ||
        "loja-padrao";
      const devLoja = await getCachedLojaBySlug(defaultSlug);
      return devLoja as TenantContext | null;
    }

    // 2. Subdomínio da plataforma gerenciada (ex: loja1.plataforma.com)
    const platformDomain = process.env.PLATFORM_DOMAIN || "plataforma.com";
    if (cleanHost.endsWith(`.${platformDomain}`)) {
      const slug = cleanHost.replace(`.${platformDomain}`, "");
      const loja = await getCachedLojaBySlug(slug);
      return loja as TenantContext | null;
    }

    // 3. Domínio Vercel de preview ou staging (ex: loja1.vercel.app)
    if (cleanHost.endsWith(".vercel.app")) {
      const slug = cleanHost.replace(".vercel.app", "");
      const loja = await getCachedLojaBySlug(slug);
      return loja as TenantContext | null;
    }

    // 4. Domínio personalizado cadastrado no banco ou slug direto
    const loja = await getCachedLojaBySlugOrDomain(cleanHost);
    return loja as TenantContext | null;
  } catch (error: any) {
    if (
      error?.digest === "DYNAMIC_SERVER_USAGE" ||
      (typeof error?.message === "string" && error.message.includes("Dynamic server usage"))
    ) {
      throw error;
    }
    console.error("[GET_LOJA_FROM_HEADERS_ERROR]", error);
    return null;
  }
});
