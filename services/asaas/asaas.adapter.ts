import {
  PaymentGateway,
  CreatePixChargeInput,
  PixChargeResult,
  PaymentStatusResult,
  PaymentGatewayError,
} from '@/types/payment-gateway.types';
import { asaasClient, AsaasClientError } from '@/services/asaas/asaas.client';
import { logger } from '@/lib/logger';

/**
 * Adapter concreto para o gateway Asaas implementando a porta de domínio PaymentGateway (DIP / Clean Architecture).
 */
export class AsaasPaymentAdapter implements PaymentGateway {
  /**
   * Cria cliente se necessário e gera a cobrança PIX com QR Code dinâmico no Asaas.
   */
  async createPixCharge(input: CreatePixChargeInput): Promise<PixChargeResult> {
    const startTime = Date.now();
    try {
      // 1. Resolver ou criar cliente no Asaas
      const asaasCustomerId = await asaasClient.getOrCreateCustomer({
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        cpfCnpj: input.customer.cpfCnpj,
      });

      // 2. Definir data de vencimento (amanhã por padrão)
      let dueDateStr = input.dueDate;
      if (!dueDateStr) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        dueDateStr = dueDate.toISOString().split('T')[0];
      }

      // 3. Criar a cobrança PIX
      const payment = await asaasClient.createPayment({
        customer: asaasCustomerId,
        billingType: 'PIX',
        value: Number(input.value),
        dueDate: dueDateStr,
        description: input.description || `Pedido #${input.orderNumber} - Continental`,
        externalReference: input.orderId,
      });

      // 4. Obter o QR Code e linha Copia e Cola
      const pixInfo = await asaasClient.getPixQrCode(payment.id);

      const durationMs = Date.now() - startTime;
      logger.info('Cobrança PIX emitida com sucesso no Asaas', {
        action: 'ASAAS_PIX_ISSUED',
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        asaasPaymentId: payment.id,
        durationMs,
        value: Number(input.value),
        customer: {
          cpfCnpj: input.customer.cpfCnpj,
          email: input.customer.email,
        },
      });

      return {
        paymentId: payment.id,
        status: payment.status,
        pixQrCodeBase64: pixInfo.encodedImage,
        pixPayload: pixInfo.payload,
        invoiceUrl: payment.invoiceUrl,
        expirationDate: pixInfo.expirationDate,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logger.error('Falha na emissão de PIX no Asaas', err, {
        action: 'ASAAS_PIX_ISSUE_FAILED',
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        durationMs,
        customer: {
          cpfCnpj: input.customer.cpfCnpj,
          email: input.customer.email,
        },
      });

      if (err instanceof AsaasClientError) {
        const errorDesc =
          err.errors && err.errors.length > 0
            ? err.errors.map((e) => e.description).join('; ')
            : err.message;
        throw new PaymentGatewayError(
          `Falha no Asaas: ${errorDesc}`,
          err.statusCode,
          err.errors?.[0]?.code || 'ASAAS_ERROR',
          err.errors
        );
      }

      throw new PaymentGatewayError(
        err?.message || 'Erro inesperado na comunicação com o gateway Asaas',
        500,
        'UNEXPECTED_GATEWAY_ERROR',
        err
      );
    }
  }

  /**
   * Consulta o status atualizado de uma cobrança no Asaas.
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    const startTime = Date.now();
    try {
      const payment = await asaasClient.getPayment(paymentId);
      const paidDateRaw =
        payment.confirmedDate ||
        (payment as any).paymentDate ||
        (payment as any).clientPaymentDate;

      logger.info('Status de cobrança consultado no Asaas', {
        action: 'ASAAS_PAYMENT_STATUS_CHECKED',
        asaasPaymentId: payment.id,
        status: payment.status,
        durationMs: Date.now() - startTime,
      });

      return {
        paymentId: payment.id,
        status: payment.status,
        paidAt: paidDateRaw ? new Date(paidDateRaw) : undefined,
        value: payment.value,
        netValue: payment.netValue,
        originalPayload: payment,
      };
    } catch (err: any) {
      logger.error('Falha ao consultar cobrança no Asaas', err, {
        action: 'ASAAS_PAYMENT_STATUS_CHECK_FAILED',
        asaasPaymentId: paymentId,
        durationMs: Date.now() - startTime,
      });

      if (err instanceof AsaasClientError) {
        throw new PaymentGatewayError(
          `Falha ao consultar Asaas: ${err.message}`,
          err.statusCode,
          'ASAAS_QUERY_ERROR',
          err.errors
        );
      }
      throw new PaymentGatewayError(
        err?.message || 'Erro inesperado ao consultar cobrança no Asaas',
        500,
        'UNEXPECTED_GATEWAY_ERROR',
        err
      );
    }
  }
}

export const asaasPaymentAdapter = new AsaasPaymentAdapter();
