import { IEmailService, SendEmailOptions, EmailResult, PasswordResetEmailParams } from "../email.types";
import { renderPasswordResetEmail } from "../templates/password-reset.template";

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
      console.log(`\n================== [DEV TRANSACTIONAL EMAIL] ==================`);
      console.log(`Para: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`);
      console.log(`Assunto: ${options.subject}`);
      console.log(`De: ${options.from || "default"}`);
      console.log(`---------------------------------------------------------------`);
      console.log(options.text || "(Apenas corpo HTML fornecido)");
      console.log(`===============================================================\n`);
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

  clear(): void {
    this.sentEmails = [];
  }

  getLastEmail(): RecordedEmail | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }
}
