/**
 * Utilitário de Logging Estruturado e Observabilidade (Finding OPS-001).
 * Gera logs estruturados em formato JSON com correlação de tenant, usuário e requisição.
 */

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

export function sanitizeLogValue(key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('cpf') || lowerKey.includes('cnpj') || lowerKey.includes('document')) {
      return maskCpfCnpj(value);
    }
    if (
      lowerKey.includes('apikey') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('auth')
    ) {
      return '[REDACTED]';
    }
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
      ...context,
    };

    const sanitized = (sanitizeLogValue('context', mergedContext) || {}) as LogContext;

    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(Object.keys(sanitized).length > 0 ? { context: sanitized } : {}),
    };

    if (err instanceof Error) {
      logEntry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    } else if (typeof err === "string") {
      logEntry.error = {
        message: err,
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
