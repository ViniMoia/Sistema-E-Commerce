/**
 * Utilitário de Logging Estruturado e Observabilidade (Finding OPS-001).
 * Gera logs estruturados em formato JSON com correlação de tenant, usuário e requisição.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  action?: string;
  [key: string]: unknown;
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

    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(Object.keys(mergedContext).length > 0 ? { context: mergedContext } : {}),
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
