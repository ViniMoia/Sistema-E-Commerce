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

export interface OrderPaymentConfirmedEmailItem {
  name: string;
  quantity: number;
  price: number;
  color?: string | null;
  size?: string | null;
}

export interface OrderPaymentConfirmedEmailParams {
  to: string;
  customerName: string;
  orderNumber: number;
  totalValue: number;
  paymentDate: Date;
  items: OrderPaymentConfirmedEmailItem[];
  deliveryType: string;
  shippingServiceName?: string | null;
  shippingEstimatedDays?: number | null;
  addressFormatted?: string | null;
  pointsEarned?: number;
  storeName?: string;
  orderUrl?: string;
}

export interface IEmailService {
  sendEmail(options: SendEmailOptions): Promise<EmailResult>;
  sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<EmailResult>;
  sendOrderPaymentConfirmedEmail(params: OrderPaymentConfirmedEmailParams): Promise<EmailResult>;
}
