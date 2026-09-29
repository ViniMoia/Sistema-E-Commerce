import {
  IEmailService,
  SendEmailOptions,
  EmailResult,
  PasswordResetEmailParams,
  OrderPaymentConfirmedEmailParams,
} from "../email.types";
import { renderPasswordResetEmail } from "../templates/password-reset.template";
import { renderOrderPaymentConfirmedEmail } from "../templates/order-payment-confirmed.template";
import { logger } from "@/lib/logger";
import { incrementMetric } from "@/lib/observability/metrics";

function emailProviderTimeoutMs(): number {
  const configured = Number(process.env.EMAIL_PROVIDER_TIMEOUT_MS || 8000);
  if (!Number.isFinite(configured)) return 8000;
  return Math.min(30000, Math.max(100, Math.trunc(configured)));
}

export class ResendEmailService implements IEmailService {
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey = apiKey || process.env.RESEND_API_KEY || "";
    this.defaultFrom = defaultFrom || process.env.EMAIL_FROM || "Continental <nao-responda@continentalestetica.com.br>";
  }

  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    if (!this.apiKey) {
      logger.warn("Provider transacional de e-mail não configurado", {
        action: "EMAIL_PROVIDER_NOT_CONFIGURED",
      });
      incrementMetric("email_provider_requests_total", {
        provider: "resend",
        result: "not_configured",
      });
      return {
        success: false,
        error: "RESEND_API_KEY não configurada no servidor.",
      };
    }

    const from = options.from || this.defaultFrom;
    const to = Array.isArray(options.to) ? options.to : [options.to];

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
        signal: AbortSignal.timeout(emailProviderTimeoutMs()),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.warn("Provider de e-mail rejeitou a mensagem", {
          action: "EMAIL_PROVIDER_REJECTED",
          provider: "RESEND",
          statusCode: response.status,
        });
        incrementMetric("email_provider_requests_total", {
          provider: "resend",
          result: "rejected",
        });
        return {
          success: false,
          error: "EMAIL_PROVIDER_REJECTED",
        };
      }

      incrementMetric("email_provider_requests_total", {
        provider: "resend",
        result: "success",
      });
      return {
        success: true,
        messageId: data.id,
      };
    } catch (error: any) {
      const timedOut = error?.name === "AbortError" || error?.name === "TimeoutError";
      logger.error("Falha ao enviar e-mail pelo provider transacional", error, {
        action: timedOut ? "EMAIL_PROVIDER_TIMEOUT" : "EMAIL_PROVIDER_REQUEST_FAILED",
        provider: "RESEND",
      });
      incrementMetric("email_provider_requests_total", {
        provider: "resend",
        result: timedOut ? "timeout" : "failed",
      });
      return {
        success: false,
        error: timedOut ? "EMAIL_PROVIDER_TIMEOUT" : "EMAIL_PROVIDER_REQUEST_FAILED",
      };
    }
  }

  async sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<EmailResult> {
    const { html, text } = renderPasswordResetEmail(params);
    return this.sendEmail({
      to: params.to,
      subject: `Redefinição de Senha - ${params.storeName || "Continental"}`,
      html,
      text,
    });
  }

  async sendOrderPaymentConfirmedEmail(params: OrderPaymentConfirmedEmailParams): Promise<EmailResult> {
    const { html, text } = renderOrderPaymentConfirmedEmail(params);
    const storeName = params.storeName || "Continental";
    return this.sendEmail({
      to: params.to,
      subject: `Pagamento Confirmado: Pedido #${params.orderNumber} - ${storeName}`,
      html,
      text,
    });
  }
}
