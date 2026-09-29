import {
  IEmailService,
  SendEmailOptions,
  EmailResult,
  PasswordResetEmailParams,
  OrderPaymentConfirmedEmailParams,
} from "../email.types";
import { renderPasswordResetEmail } from "../templates/password-reset.template";
import { renderOrderPaymentConfirmedEmail } from "../templates/order-payment-confirmed.template";

export interface RecordedEmail {
  options: SendEmailOptions;
  sentAt: Date;
  messageId: string;
}

export class DevEmailService implements IEmailService {
  public sentEmails: RecordedEmail[] = [];

  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    const messageId = `dev-email-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.sentEmails.push({
      options,
      sentAt: new Date(),
      messageId,
    });

    if (process.env.NODE_ENV !== "test") {
      console.log("[DEV_EMAIL_RECORDED]", { messageId });
    }

    return {
      success: true,
      messageId,
    };
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
    const subject = `Pagamento Confirmado: Pedido #${params.orderNumber} - ${params.storeName || "Continental"}`;
    const { html, text } = renderOrderPaymentConfirmedEmail(params);

    return this.sendEmail({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  clear(): void {
    this.sentEmails = [];
  }

  getLastEmail(): RecordedEmail | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }
}
