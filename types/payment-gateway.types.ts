/**
 * Contrato de Domínio para Provedores de Gateway de Pagamento (DIP / Clean Architecture).
 * Desacopla a camada de aplicação/checkout de SDKs e integrações proprietárias (ex: Asaas).
 */

export interface PaymentCustomerData {
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
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
   * Consulta o status atualizado de uma cobrança no gateway.
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResult>;
}
