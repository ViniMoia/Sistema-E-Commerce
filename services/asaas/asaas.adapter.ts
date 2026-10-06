import {
  PaymentGateway,
  CreatePixChargeInput,
  PixChargeResult,
  CreateCreditCardChargeInput,
  CreditCardChargeResult,
  CreateBoletoChargeInput,
  BoletoChargeResult,
  PaymentStatusResult,
  PaymentGatewayError,
} from '@/types/payment-gateway.types';
import { asaasClient, AsaasClientError } from '@/services/asaas/asaas.client';
import { calculateBusinessDueDate } from '@/services/payment/due-date.service';
import { logger } from '@/lib/logger';
import { verifyRemotePayment, verifyInstallmentContract } from '@/services/payment/gateway-contract';
import { getPaymentConfig } from '@/lib/config/payment.config';
import type { PaymentMethod } from '@/types/payment-gateway.types';

/**
 * Adapter concreto para o gateway Asaas implementando a porta de domínio PaymentGateway (DIP / Clean Architecture).
 * Suporta PIX Dinâmico, Cartão de Crédito (1x a 12x com PCI-DSS Zero-Storage) e Boleto Bancário (D+1).
 */
export class AsaasPaymentAdapter implements PaymentGateway {
  async inspectAttempt(input: { externalReference: string; paymentIds: string[]; method: PaymentMethod; installments: number }) {
    // An empty search is not proof of non-creation. The domain retains UNKNOWN.
    // List all payments by reference to detect an unexpected second contract.
    const listed = await asaasClient.listPaymentsByReference(input.externalReference);
    const payments = [...listed];
    for (const id of input.paymentIds) {
      if (!payments.some(p => p.id === id)) {
        const payment = await asaasClient.getPayment(id);
        if (payment.id !== id) throw new PaymentGatewayError('PAYMENT_CORRELATION_CONFLICT');
        payments.push(payment);
      }
    }
    const charges = [];
    for (const payment of payments) {
      const instructions: import('@/types/payment-gateway.types').RemoteCharge['instructions'] = {};
      if (!payment.deleted && payment.status === 'PENDING' && payment.billingType === 'PIX') {
        try {
          const qr = await asaasClient.getPixQrCode(payment.id);
          instructions.pixPayload = qr.payload; instructions.pixQrCodeBase64 = qr.encodedImage;
          // Provider dates without timezone are not silently interpreted in
          // the server's locale. Absence of an unambiguous expiry blocks expiry.
          if (/Z$|[+-]\d{2}:\d{2}$/.test(qr.expirationDate)) instructions.expiresAt = new Date(qr.expirationDate).toISOString();
        } catch { /* Existing charge remains recoverable without another POST. */ }
      }
      if (!payment.deleted && payment.status === 'PENDING' && payment.billingType === 'BOLETO') {
        instructions.bankSlipUrl = payment.bankSlipUrl ?? payment.invoiceUrl;
        try { instructions.digitableLine = (await asaasClient.getBoletoIdentificationField(payment.id)).identificationField; } catch { /* Reconcile later. */ }
      }
      charges.push({ paymentId: payment.id, externalReference: payment.externalReference ?? '', method: payment.billingType as PaymentMethod,
        ordinal: payment.installmentNumber ?? 1, value: payment.value, status: payment.status, deleted: payment.deleted,
        contractId: payment.installment, instructions,
        // YYYY-MM-DD in Brazil ends at 03:00 UTC the following day. Boleto
        // confirmation grace is applied separately by the domain policy.
        dueAt: /^\d{4}-\d{2}-\d{2}$/.test(payment.dueDate) ? new Date(new Date(payment.dueDate + 'T00:00:00-03:00').getTime() + 86400000).toISOString() : undefined });
    }
    return { complete: true, charges };
  }
  async cancelPayment(paymentId: string) { await asaasClient.cancelPayment(paymentId); }
  async refundPayment(paymentId: string, amount: number) { await asaasClient.refundPayment(paymentId, amount); }
  async capabilities(lojaID: string) {
    const configured = process.env.PAYMENT_REMOTE_ENABLED === 'true' && asaasClient.configurationReady() &&
      (process.env.ASAAS_ENABLED_LOJA_IDS ?? '').split(',').map(id => id.trim()).includes(lojaID);
    return { configured, methods: configured ? ['PIX', 'BOLETO', 'CREDIT_CARD'] as PaymentMethod[] : [],
      maximumInstallments: process.env.ASAAS_INSTALLMENTS_APPROVED === 'true' ? getPaymentConfig().installmentMaxCount : 1 };
  }
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
      verifyRemotePayment(payment, { orderId: input.orderId, method: 'PIX', value: input.value });
      if (!pixInfo.payload || !pixInfo.encodedImage) throw new PaymentGatewayError('PAYMENT_ARTIFACTS_MISSING');

      const durationMs = Date.now() - startTime;
      logger.info('Cobrança PIX emitida com sucesso no Asaas', {
        action: 'ASAAS_PIX_ISSUED',
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        asaasPaymentId: payment.id,
        durationMs,
        value: Number(input.value),
      });

      return {
        paymentId: payment.id,
        value: payment.value,
        status: payment.status,
        pixQrCodeBase64: pixInfo.encodedImage,
        pixPayload: pixInfo.payload,
        invoiceUrl: payment.invoiceUrl,
        expirationDate: pixInfo.expirationDate,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logger.error('Falha na emissão de PIX no Asaas', new Error('PAYMENT_GATEWAY_FAILED'), {
        action: 'ASAAS_PIX_ISSUE_FAILED',
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        durationMs,
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
   * Processa pagamento via Cartão de Crédito no Asaas com parcelamento e conformidade PCI-DSS.
   */
  async createCreditCardCharge(
    input: CreateCreditCardChargeInput
  ): Promise<CreditCardChargeResult> {
    const startTime = Date.now();
    const cleanCardNumber = input.creditCard.number.replace(/\D/g, '');
    const cardLast4 = cleanCardNumber.slice(-4);

    try {
      if (!/^\d{8}$/.test((input.customer.postalCode ?? '').replace(/\D/g, '')) || !input.customer.addressNumber?.trim()) throw new PaymentGatewayError('PAYMENT_CARD_BILLING_REQUIRED');
      // 1. Resolver ou criar cliente no Asaas
      const asaasCustomerId = await asaasClient.getOrCreateCustomer({
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        cpfCnpj: input.customer.cpfCnpj,
      });

      const todayStr = new Date().toISOString().split('T')[0];

      // 2. Montar payload estritamente compatível com o Asaas
      const cleanPhone = input.customer.phone.replace(/\D/g, '');
      const cleanPostal = (input.customer.postalCode ?? '').replace(/\D/g, '');

      const isInstallment = input.installmentCount !== undefined && input.installmentCount > 1;

      const paymentPayload: any = {
        customer: asaasCustomerId,
        billingType: 'CREDIT_CARD',
        value: Number(input.value),
        dueDate: todayStr,
        description: input.description || `Pedido #${input.orderNumber} - Continental`,
        externalReference: input.orderId,
        creditCard: {
          holderName: input.creditCard.holderName.trim().toUpperCase(),
          number: cleanCardNumber,
          expiryMonth: input.creditCard.expiryMonth.padStart(2, '0'),
          expiryYear: input.creditCard.expiryYear,
          ccv: input.creditCard.ccv.trim(),
        },
        creditCardHolderInfo: {
          name: input.customer.name.trim(),
          email: input.customer.email.trim().toLowerCase(),
          cpfCnpj: input.customer.cpfCnpj.replace(/\D/g, ''),
          postalCode: cleanPostal,
          addressNumber: input.customer.addressNumber,
          addressComplement: input.customer.addressComplement || undefined,
          phone: cleanPhone,
          mobilePhone: cleanPhone,
        },
      };

      if (isInstallment) {
        paymentPayload.installmentCount = input.installmentCount;
        delete paymentPayload.value;
        paymentPayload.totalValue = Number(input.value);
      }

      // 3. Executar cobrança no Asaas
      const payment = await asaasClient.createPayment(paymentPayload);
      if (isInstallment && !payment.installment) throw new PaymentGatewayError('PAYMENT_CONTRACT_INCOMPLETE');
      const charges = isInstallment ? await asaasClient.listInstallmentPayments(payment.installment!) : [payment];
      const verifiedCharges = isInstallment
        ? verifyInstallmentContract(charges, { orderId: input.orderId, contractId: payment.installment ?? '', value: input.value, count: input.installmentCount! })
        : [{ paymentId: verifyRemotePayment(payment, { orderId: input.orderId, method: 'CREDIT_CARD', value: input.value }).id, ordinal: 1, value: payment.value, status: payment.status }];
      if (isInstallment && !verifiedCharges.some(charge => charge.paymentId === payment.id && charge.ordinal === payment.installmentNumber && charge.value === payment.value && charge.status === payment.status)) throw new PaymentGatewayError('PAYMENT_CONTRACT_MISMATCH');

      const durationMs = Date.now() - startTime;
      logger.info('Cobrança de cartão processada no Asaas', {
        action: 'ASAAS_CREDIT_CARD_PROCESSED',
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        asaasPaymentId: payment.id,
        status: payment.status,
        cardLast4,
        installments: input.installmentCount || 1,
        durationMs,
      });

      return {
        paymentId: payment.id,
        status: payment.status,
        value: input.value, contractId: payment.installment, charges: verifiedCharges,
        approvedForEntireContract: verifiedCharges.every(charge => ['CONFIRMED', 'RECEIVED'].includes(charge.status)),
        creditCardBrand: payment.creditCard?.creditCardBrand || 'CARTAO',
        creditCardLast4: payment.creditCard?.creditCardNumber
          ? payment.creditCard.creditCardNumber.slice(-4)
          : cardLast4,
        invoiceUrl: payment.invoiceUrl,
        transactionReceiptUrl: payment.transactionReceiptUrl,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logger.error('Falha no processamento de cartão de crédito no Asaas', new Error('PAYMENT_GATEWAY_FAILED'), {
        action: 'ASAAS_CREDIT_CARD_FAILED',
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        cardLast4,
        durationMs,
      });

      if (err instanceof AsaasClientError) {
        const errorDesc =
          err.errors && err.errors.length > 0
            ? err.errors.map((e) => e.description).join('; ')
            : err.message;
        throw new PaymentGatewayError(
          `Falha no Cartão: ${errorDesc}`,
          err.statusCode,
          err.errors?.[0]?.code || 'CREDIT_CARD_REFUSED',
          err.errors
        );
      }

      throw new PaymentGatewayError(
        err?.message || 'Erro inesperado no processamento do cartão de crédito',
        500,
        'UNEXPECTED_GATEWAY_ERROR',
        err
      );
    }
  }

  /**
   * Emite Boleto Bancário com vencimento de 1 dia útil (D+1), linha digitável e código de barras.
   */
  async createBoletoCharge(input: CreateBoletoChargeInput): Promise<BoletoChargeResult> {
    const startTime = Date.now();
    try {
      // 1. Resolver ou criar cliente no Asaas
      const asaasCustomerId = await asaasClient.getOrCreateCustomer({
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        cpfCnpj: input.customer.cpfCnpj,
      });

      // 2. Definir vencimento em 1 dia útil (D+1) caso não especificado
      let dueDateStr = input.dueDate;
      if (!dueDateStr) {
        const { dueDateString } = calculateBusinessDueDate(getPaymentConfig().boletoDueDays);
        dueDateStr = dueDateString;
      }

      // 3. Emitir boleto no Asaas
      const payment = await asaasClient.createPayment({
        customer: asaasCustomerId,
        billingType: 'BOLETO',
        value: Number(input.value),
        dueDate: dueDateStr,
        description: input.description || `Pedido #${input.orderNumber} - Continental`,
        externalReference: input.orderId,
      });

      // 4. Buscar linha digitável e código de barras
      let digitableLine = payment.identificationField || '';
      let barCode = '';

      try {
        const boletoInfo = await asaasClient.getBoletoIdentificationField(payment.id);
        digitableLine = boletoInfo.identificationField || digitableLine;
        barCode = boletoInfo.barCode || '';
      } catch (lineErr) {
        logger.warn('Não foi possível obter linha digitável auxiliar do boleto imediatamente', {
          action: 'ASAAS_BOLETO_IDENTIFICATION_FIELD_FALLBACK',
          paymentId: payment.id,
        });
      }

      const bankSlipUrl = payment.bankSlipUrl || payment.invoiceUrl || '';
      verifyRemotePayment(payment, { orderId: input.orderId, method: 'BOLETO', value: input.value });
      if (!bankSlipUrl || !digitableLine) throw new PaymentGatewayError('PAYMENT_ARTIFACTS_MISSING');

      const durationMs = Date.now() - startTime;
      logger.info('Boleto bancário emitido com sucesso no Asaas', {
        action: 'ASAAS_BOLETO_ISSUED',
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        asaasPaymentId: payment.id,
        dueDate: dueDateStr,
        durationMs,
      });

      return {
        paymentId: payment.id,
        status: payment.status,
        bankSlipUrl,
        value: payment.value,
        digitableLine,
        barCode,
        dueDate: payment.dueDate || dueDateStr,
        invoiceUrl: payment.invoiceUrl,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logger.error('Falha na emissão de boleto no Asaas', new Error('PAYMENT_GATEWAY_FAILED'), {
        action: 'ASAAS_BOLETO_ISSUE_FAILED',
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        durationMs,
      });

      if (err instanceof AsaasClientError) {
        const errorDesc =
          err.errors && err.errors.length > 0
            ? err.errors.map((e) => e.description).join('; ')
            : err.message;
        throw new PaymentGatewayError(
          `Falha no Boleto: ${errorDesc}`,
          err.statusCode,
          err.errors?.[0]?.code || 'BOLETO_ISSUE_ERROR',
          err.errors
        );
      }

      throw new PaymentGatewayError(
        err?.message || 'Erro inesperado na emissão do boleto bancário',
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
      logger.error('Falha ao consultar cobrança no Asaas', new Error('PAYMENT_GATEWAY_FAILED'), {
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
