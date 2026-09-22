import {
  IEmailService,
  SendEmailOptions,
  EmailResult,
  PasswordResetEmailParams,
  OrderPaymentConfirmedEmailParams,
} from "../email.types";
import { renderPasswordResetEmail } from "../templates/password-reset.template";
import { renderOrderPaymentConfirmedEmail } from "../templates/order-payment-confirmed.template";

export class ResendEmailService implements IEmailService {
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey = apiKey || process.env.RESEND_API_KEY || "";
    this.defaultFrom = defaultFrom || process.env.EMAIL_FROM || "Continental <nao-responda@continentalestetica.com.br>";
  }

  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    if (!this.apiKey) {
      console.warn("[ResendEmailService] RESEND_API_KEY não está configurada no ambiente. E-mail não enviado.");
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
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[ResendEmailService] Erro retornado pela API do Resend:", data);
        return {
          success: false,
          error: data?.message || "Erro desconhecido retornado pelo Resend",
        };
      }

      return {
        success: true,
        messageId: data.id,
      };
    } catch (error: any) {
      console.error("[ResendEmailService] Exceção ao enviar e-mail via Resend:", error);
      return {
        success: false,
        error: error.message || "Falha de rede ao conectar com a API do Resend",
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
