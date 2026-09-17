export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PasswordResetEmailParams {
  to: string;
  name: string;
  resetUrl: string;
  storeName?: string;
}

export interface IEmailService {
  sendEmail(options: SendEmailOptions): Promise<EmailResult>;
  sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<EmailResult>;
}
