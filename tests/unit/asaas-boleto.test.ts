import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
import { asaasClient, AsaasClientError } from '@/services/asaas/asaas.client';
import { POST as webhookHandler } from '@/app/api/webhooks/asaas/route';
import prisma from '@/lib/prisma';
import * as orderService from '@/services/order.service';

describe('Meio de Pagamento: Boleto Bancário (Asaas & Webhook)', () => {
  let adapter: AsaasPaymentAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AsaasPaymentAdapter();
    process.env.ASAAS_WEBHOOK_TOKEN = 'test_webhook_token_secure_123';
  });

  describe('1. AsaasPaymentAdapter: createBoletoCharge', () => {
    it('deve emitir boleto bancário com vencimento D+1, linha digitável e código de barras', async () => {
      vi.spyOn(asaasClient, 'getOrCreateCustomer').mockResolvedValueOnce('cus_bol_123');
      vi.spyOn(asaasClient, 'createPayment').mockResolvedValueOnce({
        id: 'pay_bol_999',
        customer: 'cus_bol_123',
        billingType: 'BOLETO',
        status: 'PENDING',
        value: 250.0,
        netValue: 247.0,
        dateCreated: '2026-09-23',
        dueDate: '2026-09-24',
        bankSlipUrl: 'https://asaas.com/b/pdf999',
        invoiceUrl: 'https://asaas.com/i/bol999',
      });

      vi.spyOn(asaasClient, 'getBoletoIdentificationField').mockResolvedValueOnce({
        identificationField: '00190.00009 01234.567802 00000.000123 1 99990000025000',
        barCode: '00191999900000250000000001234567800000000012',
      });

      const result = await adapter.createBoletoCharge({
        orderId: 'ord-bol-1',
        orderNumber: 3001,
        value: 250.0,
        customer: {
          name: 'Roberto Firmino',
          email: 'roberto@continental.com',
          phone: '(11) 98888-7777',
          cpfCnpj: '529.982.247-25',
          postalCode: '01310-100',
          addressNumber: '500',
        },
      });

      expect(result.paymentId).toBe('pay_bol_999');
      expect(result.status).toBe('PENDING');
      expect(result.bankSlipUrl).toBe('https://asaas.com/b/pdf999');
      expect(result.digitableLine).toBe('00190.00009 01234.567802 00000.000123 1 99990000025000');
      expect(result.barCode).toBe('00191999900000250000000001234567800000000012');
      expect(result.dueDate).toBe('2026-09-24');
    });

    it('deve usar fallback se a consulta de linha digitável auxiliar falhar', async () => {
      vi.spyOn(asaasClient, 'getOrCreateCustomer').mockResolvedValueOnce('cus_bol_123');
      vi.spyOn(asaasClient, 'createPayment').mockResolvedValueOnce({
        id: 'pay_bol_888',
        customer: 'cus_bol_123',
        billingType: 'BOLETO',
        status: 'PENDING',
        value: 100.0,
        netValue: 98.0,
        dateCreated: '2026-09-23',
        dueDate: '2026-09-24',
        bankSlipUrl: 'https://asaas.com/b/pdf888',
        identificationField: 'linha_digitavel_nativa',
      });

      vi.spyOn(asaasClient, 'getBoletoIdentificationField').mockRejectedValueOnce(
        new AsaasClientError('Serviço temporariamente indisponível', 503)
      );

      const result = await adapter.createBoletoCharge({
        orderId: 'ord-bol-fallback',
        orderNumber: 3002,
        value: 100.0,
        customer: {
          name: 'Teste Fallback',
          email: 'fallback@teste.com',
          phone: '11999999999',
          cpfCnpj: '529.982.247-25',
        },
      });

      expect(result.paymentId).toBe('pay_bol_888');
      expect(result.digitableLine).toBe('linha_digitavel_nativa');
    });
  });

  describe('2. Ciclo de Vida e Webhook do Boleto Bancário', () => {
    it('deve cancelar o pedido quando o boleto vencer (PAYMENT_OVERDUE) liberando estoque', async () => {
      vi.spyOn(prisma.paymentWebhookEvent, 'create').mockResolvedValueOnce({
        id: 'evt_overdue_1',
      } as any);

      vi.spyOn(prisma.order, 'findFirst').mockResolvedValueOnce({
        id: 'ord-bol-vencido',
        lojaID: 'loja-continental',
        status: 'PENDING',
        total: 150.0,
      } as any);

      const updateSpy = vi.spyOn(orderService, 'updateOrderStatus').mockResolvedValueOnce({
        success: true,
        order: { id: 'ord-bol-vencido', status: 'CANCELLED' },
      } as any);

      vi.spyOn(prisma.order, 'update').mockResolvedValueOnce({} as any);

      const req = new Request('http://localhost/api/webhooks/asaas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': 'test_webhook_token_secure_123',
        },
        body: JSON.stringify({
          id: 'evt_overdue_1',
          event: 'PAYMENT_OVERDUE',
          payment: {
            id: 'pay_bol_vencido',
            status: 'OVERDUE',
            externalReference: 'ord-bol-vencido',
            value: 150.0,
          },
        }),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ord-bol-vencido',
          newStatus: 'CANCELLED',
        })
      );
    });

    it('deve registrar nota administrativa em PAYMENT_AWAITING_RISK_ANALYSIS sem transicionar para PAID', async () => {
      vi.spyOn(prisma.paymentWebhookEvent, 'create').mockResolvedValueOnce({
        id: 'evt_risk_1',
      } as any);

      vi.spyOn(prisma.order, 'findFirst').mockResolvedValueOnce({
        id: 'ord-risk-1',
        lojaID: 'loja-continental',
        status: 'PENDING',
        total: 500.0,
      } as any);

      const updateOrderSpy = vi.spyOn(prisma.order, 'update').mockResolvedValue({} as any);
      const updateStatusSpy = vi.spyOn(orderService, 'updateOrderStatus');

      const req = new Request('http://localhost/api/webhooks/asaas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': 'test_webhook_token_secure_123',
        },
        body: JSON.stringify({
          id: 'evt_risk_1',
          event: 'PAYMENT_AWAITING_RISK_ANALYSIS',
          payment: {
            id: 'pay_risk_999',
            status: 'AWAITING_RISK_ANALYSIS',
            externalReference: 'ord-risk-1',
            value: 500.0,
          },
        }),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);

      // Não deve ter chamado transição para PAID
      expect(updateStatusSpy).not.toHaveBeenCalled();

      // Deve ter atualizado adminNotes com alerta de análise de segurança
      expect(updateOrderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-risk-1' },
          data: expect.objectContaining({
            adminNotes: expect.stringContaining('ANÁLISE DE SEGURANÇA'),
          }),
        })
      );
    });
  });
});
