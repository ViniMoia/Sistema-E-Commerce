import { NextResponse } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpeza periódica de entradas expiradas para prevenir memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetAt) {
        rateLimitStore.delete(key);
      }
    }
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
 * Utilitário de Rate Limiting em memória (Finding SEC-005).
 */
export function rateLimit(
  identifier: string,
  limit = 10,
  windowMs = 60000
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
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

/**
 * Extrai o endereço IP do cliente a partir dos headers de proxy reverso.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
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
