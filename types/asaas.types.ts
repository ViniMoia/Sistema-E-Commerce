export type AsaasBillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUND_REQUESTED'
  | 'REFUND_IN_PROGRESS'
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
  | 'PAYMENT_PARTIALLY_REFUNDED'
  | 'PAYMENT_REFUND_IN_PROGRESS'
  | 'PAYMENT_REFUND_DENIED'
  | 'PAYMENT_RECEIVED_IN_CASH_UNDONE'
  | 'PAYMENT_CHARGEBACK_REQUESTED'
  | 'PAYMENT_CHARGEBACK_DISPUTE'
  | 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
  | 'PAYMENT_DUNNING_REQUESTED'
  | 'PAYMENT_DUNNING_RECEIVED'
  | 'PAYMENT_AWAITING_RISK_ANALYSIS';

export interface AsaasCreditCard {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasCreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
  phone: string;
  mobilePhone?: string;
}

export interface AsaasPaymentPayload {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string; // ID do pedido em nosso sistema
  postalService?: boolean;
  creditCard?: AsaasCreditCard;
  creditCardHolderInfo?: AsaasCreditCardHolderInfo;
  creditCardToken?: string;
  installmentCount?: number;
  installmentValue?: number;
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
  creditCard?: {
    creditCardNumber?: string;
    creditCardBrand?: string;
    creditCardToken?: string;
  };
  nossoNumero?: string;
  identificationField?: string;
  installmentNumber?: number;
}

export interface AsaasPaymentListResponse {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: AsaasPaymentResponse[];
}

export type AsaasPaymentRefundStatus =
  | 'PENDING'
  | 'AWAITING_CRITICAL_ACTION_AUTHORIZATION'
  | 'AWAITING_CUSTOMER_EXTERNAL_AUTHORIZATION'
  | 'CANCELLED'
  | 'DONE';

export interface AsaasPaymentRefundResponse {
  dateCreated: string;
  status: AsaasPaymentRefundStatus;
  value: number;
  description?: string;
  effectiveDate?: string;
  transactionReceiptUrl?: string;
}

export interface AsaasPaymentRefundListResponse {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: AsaasPaymentRefundResponse[];
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string; // Base64 PNG do QR Code
  payload: string;      // Código copia e cola PIX
  expirationDate: string;
}

export interface AsaasBoletoIdentificationFieldResponse {
  identificationField: string;
  nossoNumero?: string;
  barCode: string;
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
    bankSlipUrl?: string;
    transactionReceiptUrl?: string;
    confirmedDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    creditCard?: {
      creditCardNumber?: string;
      creditCardBrand?: string;
      creditCardToken?: string;
    };
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
