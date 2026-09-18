export type AsaasBillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH_UNDONE'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS';

export type AsaasWebhookEventType =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_RESTORED'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_RECEIVED_IN_CASH_UNDONE'
  | 'PAYMENT_CHARGEBACK_REQUESTED'
  | 'PAYMENT_CHARGEBACK_DISPUTE'
  | 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
  | 'PAYMENT_DUNNING_REQUESTED'
  | 'PAYMENT_DUNNING_RECEIVED'
  | 'PAYMENT_AWAITING_RISK_ANALYSIS';

export interface AsaasPaymentPayload {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string; // ID do pedido em nosso sistema
  postalService?: boolean;
}

export interface AsaasPaymentResponse {
  id: string;
  customer: string;
  dateCreated: string;
  dueDate: string;
  value: number;
  netValue: number;
  billingType: AsaasBillingType;
  status: AsaasPaymentStatus;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
  deleted?: boolean;
  confirmedDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string; // Base64 PNG do QR Code
  payload: string;      // Código copia e cola PIX
  expirationDate: string;
}

export interface AsaasWebhookPayload {
  id?: string;
  event: AsaasWebhookEventType;
  dateCreated?: string;
  payment: {
    id: string;
    customer?: string;
    dateCreated?: string;
    dueDate?: string;
    value: number;
    netValue?: number;
    billingType: AsaasBillingType;
    status: AsaasPaymentStatus;
    description?: string;
    externalReference?: string;
    invoiceUrl?: string;
    transactionReceiptUrl?: string;
    confirmedDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
  };
}

export interface AsaasCustomerResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  deleted?: boolean;
}

export interface AsaasCustomerListResponse {
  object: string;
  hasMore: boolean;
  totalCount: number;
  data: AsaasCustomerResponse[];
}

export interface AsaasCreateCustomerPayload {
  name: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  notificationDisabled?: boolean;
}
