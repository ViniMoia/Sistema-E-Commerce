/**
 * Utilitário de Logging Estruturado e Observabilidade (Finding OPS-001).
 * Gera logs estruturados em formato JSON com correlação de tenant, usuário e requisição.
 */

import { getLogContext } from '@/lib/observability/request-context'

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  orderId?: string;
  orderNumber?: number;
  asaasPaymentId?: string;
  action?: string;
  [key: string]: unknown;
}

export function maskCpfCnpj(doc: string): string {
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}.***.***-${clean.slice(9)}`;
  }
  if (clean.length === 14) {
    return `${clean.slice(0, 2)}.***.***/****-${clean.slice(12)}`;
  }
  return '***.***.***-**';
}

export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '[EMAIL_REDACTED]';
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}***@${domain.toLowerCase()}`;
}

export function sanitizeLogText(value: string): string {
  return value
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi, '$1[REDACTED]@')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL_REDACTED]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[DOCUMENT_REDACTED]')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}-?\d{2}\b/g, '[DOCUMENT_REDACTED]')
    .replace(/(?<![A-Fa-f0-9])(?:\+?55[\s-]*)?\(?\d{2}\)?[\s-]*9?\d{4}[-\s]?\d{4}(?![A-Fa-f0-9])/g, '[PHONE_REDACTED]')
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:[?&]|\b)(?:token|api[_-]?key|secret|password|cookie|session)=)[^&\s;]+/gi, '$1[REDACTED]')
    .replace(/((?:reset|access|refresh|webhook)?[_-]?token\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

export function sanitizeLogValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    lowerKey.includes('apikey') ||
    lowerKey.includes('secret') ||
    lowerKey.includes('password') ||
    lowerKey.includes('token') ||
    lowerKey.includes('auth') ||
    lowerKey.includes('cookie') ||
    lowerKey.includes('session') ||
    lowerKey.includes('credential') ||
    lowerKey.includes('cardnumber') ||
    lowerKey === 'payload' ||
    lowerKey === 'body' ||
    lowerKey === 'html' ||
    lowerKey === 'text' ||
    lowerKey === 'content'
  ) {
    return '[REDACTED]';
  }
  if (
    lowerKey.includes('email') ||
    lowerKey.includes('phone') ||
    lowerKey.includes('telefone') ||
    lowerKey.includes('address') ||
    lowerKey.includes('endereco') ||
    lowerKey.includes('street') ||
    lowerKey.includes('cep') ||
    lowerKey.includes('document') ||
    lowerKey.includes('cpf') ||
    lowerKey.includes('cnpj')
  ) {
    return '[PII_REDACTED]';
  }

  if (typeof value === 'string') {
    return sanitizeLogText(value);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeLogValue(key, item));
    }
    const sanitizedObj: Record<string, unknown> = {};
    for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
      sanitizedObj[subKey] = sanitizeLogValue(subKey, subVal);
    }
    return sanitizedObj;
  }

  return value;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

export class Logger {
  private defaultContext: LogContext;

  constructor(defaultContext: LogContext = {}) {
    this.defaultContext = defaultContext;
  }

  public withContext(context: LogContext): Logger {
    return new Logger({
      ...this.defaultContext,
      ...context,
    });
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
    err?: unknown
  ): StructuredLog {
    const mergedContext = {
      ...this.defaultContext,
      ...getLogContext(),
      ...context,
    };

    const sanitized = (sanitizeLogValue('context', mergedContext) || {}) as LogContext;

    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message: sanitizeLogText(message),
      ...(Object.keys(sanitized).length > 0 ? { context: sanitized } : {}),
    };

    if (err instanceof Error) {
      logEntry.error = {
        name: sanitizeLogText(err.name),
        message: sanitizeLogText(err.message),
        stack: err.stack ? sanitizeLogText(err.stack) : undefined,
      };
    } else if (typeof err === "string") {
      logEntry.error = {
        message: sanitizeLogText(err),
      };
    }

    return logEntry;
  }

  public info(message: string, context?: LogContext): StructuredLog {
    const formatted = this.formatLog("info", message, context);
    if (process.env.NODE_ENV !== "test") {
      console.log(JSON.stringify(formatted));
    }
    return formatted;
  }

  public warn(message: string, context?: LogContext, err?: unknown): StructuredLog {
    const formatted = this.formatLog("warn", message, context, err);
    if (process.env.NODE_ENV !== "test") {
      console.warn(JSON.stringify(formatted));
    }
    return formatted;
  }

  public error(message: string, err?: unknown, context?: LogContext): StructuredLog {
    const formatted = this.formatLog("error", message, context, err);
    if (process.env.NODE_ENV !== "test") {
      console.error(JSON.stringify(formatted));
    }
    return formatted;
  }

  public debug(message: string, context?: LogContext): StructuredLog {
    const formatted = this.formatLog("debug", message, context);
    if (process.env.NODE_ENV === "development") {
      console.debug(JSON.stringify(formatted));
    }
    return formatted;
  }
}

export const logger = new Logger();
