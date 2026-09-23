/**
 * Contrato de Domínio para Provedores de Gateway de Pagamento (DIP / Clean Architecture).
 * Desacopla a camada de aplicação/checkout de SDKs e integrações proprietárias (ex: Asaas).
 */

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'WHATSAPP_PIX';

export interface PaymentCustomerData {
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  postalCode?: string;
  addressNumber?: string;
  addressComplement?: string;
}

export interface CreatePixChargeInput {
  orderId: string;
  orderNumber: number;
  value: number;
  customer: PaymentCustomerData;
  dueDate?: string; // YYYY-MM-DD
  description?: string;
}

export interface PixChargeResult {
  paymentId: string;
  status: string;
  pixQrCodeBase64: string; // Base64 da imagem PNG do QR Code (sem prefixo data:)
  pixPayload: string;      // Linha digitável Copia e Cola
  invoiceUrl?: string;
  expirationDate?: string;
}

export interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string; // MM
  expiryYear: string;  // YYYY
  ccv: string;
}

export interface CreateCreditCardChargeInput {
  orderId: string;
  orderNumber: number;
  value: number;
  customer: PaymentCustomerData;
  creditCard: CreditCardData;
  installmentCount?: number;
  installmentValue?: number;
  description?: string;
}

export interface CreditCardChargeResult {
  paymentId: string;
  status: string; // 'CONFIRMED' | 'AWAITING_RISK_ANALYSIS' | 'PENDING'
  creditCardBrand?: string;
  creditCardLast4?: string;
  invoiceUrl?: string;
  transactionReceiptUrl?: string;
}

export interface CreateBoletoChargeInput {
  orderId: string;
  orderNumber: number;
  value: number;
  customer: PaymentCustomerData;
  dueDate?: string; // YYYY-MM-DD
  description?: string;
}

export interface BoletoChargeResult {
  paymentId: string;
  status: string;
  bankSlipUrl: string;
  digitableLine: string;
  barCode?: string;
  dueDate: string;
  invoiceUrl?: string;
}

export interface PaymentStatusResult {
  paymentId: string;
  status: string;
  paidAt?: Date;
  value?: number;
  netValue?: number;
  originalPayload?: unknown;
}

export class PaymentGatewayError extends Error {
  public readonly statusCode?: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'PaymentGatewayError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface PaymentGateway {
  /**
   * Registra cliente e cria cobrança PIX com geração de QR Code dinâmico.
   */
  createPixCharge(input: CreatePixChargeInput): Promise<PixChargeResult>;

  /**
   * Registra cliente e processa cobrança via Cartão de Crédito (1x até 12x).
   */
  createCreditCardCharge(input: CreateCreditCardChargeInput): Promise<CreditCardChargeResult>;

  /**
   * Registra cliente e emite Boleto Bancário com linha digitável e código de barras.
   */
  createBoletoCharge(input: CreateBoletoChargeInput): Promise<BoletoChargeResult>;

  /**
   * Consulta o status atualizado de uma cobrança no gateway.
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResult>;
}
