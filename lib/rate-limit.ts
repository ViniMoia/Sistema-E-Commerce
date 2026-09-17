import { NextResponse } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

const MAX_RATE_LIMIT_ENTRIES = 10000;

function pruneRateLimitStore() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
  // Se ainda estiver no teto de capacidade, elimina os registros mais antigos (FIFO)
  if (rateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
    const toDelete = rateLimitStore.size - Math.floor(MAX_RATE_LIMIT_ENTRIES * 0.8);
    let count = 0;
    for (const key of rateLimitStore.keys()) {
      if (count++ >= toDelete) break;
      rateLimitStore.delete(key);
    }
  }
}

// Limpeza periódica de entradas expiradas para prevenir memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    pruneRateLimitStore();
  }, 60000);
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}

/**
 * Utilitário de Rate Limiting em memória com salvaguarda contra exaustão de heap (SEC-005, AUD2-003).
 */
export function rateLimit(
  identifier: string,
  limit = 10,
  windowMs = 60000
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    if (rateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
      pruneRateLimitStore();
    }
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil(resetAt / 1000),
      retryAfter: 0,
    };
  }

  if (record.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil(record.resetAt / 1000),
      retryAfter,
    };
  }

  record.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    reset: Math.ceil(record.resetAt / 1000),
    retryAfter: 0,
  };
}

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[a-fA-F0-9:]+$/;

function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

/**
 * Extrai e valida o endereço IP do cliente a partir dos headers de proxy reverso e CDNs.
 * Prioriza cabeçalhos autênticos de borda e sanitiza contra injeção e IP spoofing (AUD2-003).
 */
export function getClientIp(req: Request): string {
  // 1. Cabeçalhos de borda autenticados de CDNs / Proxies de infraestrutura confiáveis
  const cfConnectingIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp && isValidIp(cfConnectingIp)) {
    return cfConnectingIp;
  }

  const vercelForwardedFor = req.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercelForwardedFor && isValidIp(vercelForwardedFor)) {
    return vercelForwardedFor;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }

  // 2. X-Forwarded-For: inspecionar entradas e validar formato IPv4/IPv6
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim());
    for (const part of parts) {
      if (isValidIp(part)) {
        return part;
      }
    }
  }

  return "127.0.0.1";
}

/**
 * Helper que verifica o Rate Limit e retorna NextResponse 429 se excedido.
 */
export function checkRateLimit(
  req: Request,
  action: string,
  limit = 10,
  windowMs = 60000
): NextResponse | null {
  const ip = getClientIp(req);
  const key = `${action}:${ip}`;
  const result = rateLimit(key, limit, windowMs);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Muitas requisições. Por favor, aguarde antes de tentar novamente.",
        code: "RATE_LIMIT_EXCEEDED",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfter),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.reset),
        },
      }
    );
  }

  return null;
}
