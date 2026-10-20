import { IEmailService } from "./email.types";
import { ResendEmailService } from "./providers/resend.provider";
import { DevEmailService } from "./providers/dev.provider";

export * from "./email.types";
export * from "./templates/password-reset.template";
export * from "./templates/order-payment-confirmed.template";
export * from "./providers/resend.provider";
export * from "./providers/dev.provider";

let currentEmailService: IEmailService | null = null;

export function getEmailService(): IEmailService {
  if (currentEmailService) {
    return currentEmailService;
  }

  // Production must never acknowledge a simulated delivery. The real provider
  // returns a configuration failure when its key is missing, without email data.
  if (process.env.NODE_ENV === "production" ||
    (process.env.RESEND_API_KEY && process.env.NODE_ENV !== "test")) {
    currentEmailService = new ResendEmailService();
  } else {
    currentEmailService = new DevEmailService();
  }

  return currentEmailService;
}

export function setEmailService(service: IEmailService | null): void {
  currentEmailService = service;
}

export const emailService = {
  sendEmail: (options: Parameters<IEmailService["sendEmail"]>[0]) => getEmailService().sendEmail(options),
  sendPasswordResetEmail: (params: Parameters<IEmailService["sendPasswordResetEmail"]>[0]) =>
    getEmailService().sendPasswordResetEmail(params),
  sendOrderPaymentConfirmedEmail: (params: Parameters<IEmailService["sendOrderPaymentConfirmedEmail"]>[0]) =>
    getEmailService().sendOrderPaymentConfirmedEmail(params),
};
