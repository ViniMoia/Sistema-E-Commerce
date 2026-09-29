import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
import { AsaasClient, asaasClient, AsaasClientError } from '@/services/asaas/asaas.client';
import { PaymentGatewayError } from '@/types/payment-gateway.types';
import { createOrderSchema } from '@/lib/validators/checkout.validators';

describe('AsaasPaymentAdapter (DIP / Clean Architecture)', () => {
  let adapter: AsaasPaymentAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AsaasPaymentAdapter();
  });

  describe('createPixCharge', () => {
    it('deve gerar cobrança PIX com sucesso mapeando DTO de domínio para Asaas', async () => {
      vi.spyOn(asaasClient, 'getOrCreateCustomer').mockResolvedValueOnce('cus_test_123');
      vi.spyOn(asaasClient, 'createPayment').mockResolvedValueOnce({
        id: 'pay_test_999',
        customer: 'cus_test_123',
        billingType: 'PIX',
        status: 'PENDING',
        value: 150.0,
        netValue: 148.0,
        dateCreated: '2026-09-18',
        dueDate: '2026-09-19',
        invoiceUrl: 'https://asaas.com/i/test999',
      });
      vi.spyOn(asaasClient, 'getPixQrCode').mockResolvedValueOnce({
        encodedImage: 'base64_pix_image',
        payload: '00020126580014br.gov.bcb.pix...',
        expirationDate: '2026-09-19 23:59:59',
      });

      const result = await adapter.createPixCharge({
        orderId: 'ord-uuid-1',
        paymentReference: 'payment-reference-uuid-1',
        orderNumber: 1001,
        value: 150.0,
        customer: {
          name: 'João da Silva',
          email: 'joao@silva.com',
          phone: '(11) 98765-4321',
          cpfCnpj: '529.982.247-25',
        },
      });

      expect(result.paymentId).toBe('pay_test_999');
      expect(result.status).toBe('PENDING');
      expect(result.pixQrCodeBase64).toBe('base64_pix_image');
      expect(result.pixPayload).toContain('br.gov.bcb.pix');
      expect(result.invoiceUrl).toBe('https://asaas.com/i/test999');
      expect(asaasClient.createPayment).toHaveBeenCalledWith(expect.objectContaining({
        externalReference: 'payment-reference-uuid-1',
      }));
    });

    it('deve converter AsaasClientError em PaymentGatewayError descritivo', async () => {
      vi.spyOn(asaasClient, 'getOrCreateCustomer').mockRejectedValueOnce(
        new AsaasClientError('Falha no cliente Asaas', 400, [
          { code: 'invalid_cpf', description: 'O CPF informado é inválido.' },
        ])
      );

      await expect(
        adapter.createPixCharge({
          orderId: 'ord-uuid-2',
          paymentReference: 'payment-reference-uuid-2',
          orderNumber: 1002,
          value: 200.0,
          customer: {
            name: 'Cliente Inválido',
            email: 'invalido@teste.com',
            phone: '11999998888',
            cpfCnpj: '00000000000',
          },
        })
      ).rejects.toThrow(PaymentGatewayError);
    });

    it('deve adotar Fail-Closed e lançar PaymentGatewayError se houver timeout ou erro de rede', async () => {
      vi.spyOn(asaasClient, 'getOrCreateCustomer').mockRejectedValueOnce(
        new Error('The operation was aborted due to timeout')
      );

      await expect(
        adapter.createPixCharge({
          orderId: 'ord-uuid-3',
          paymentReference: 'payment-reference-uuid-3',
          orderNumber: 1003,
          value: 99.9,
          customer: {
            name: 'Cliente Timeout',
            email: 'timeout@teste.com',
            phone: '11999998888',
            cpfCnpj: '529.982.247-25',
          },
        })
      ).rejects.toThrow(PaymentGatewayError);
    });
  });

  describe('Proteção de Ambiente no Cliente Asaas (Fail-Closed)', () => {
    it('deve impedir inicialização de chave de produção com URL de Sandbox', () => {
      expect(() => {
        new (asaasClient.constructor as any)(
          'https://sandbox.asaas.com/api/v3',
          '$aact_prod_dummy_mock_key_for_test_environment_guard'
        );
      }).toThrow(/Chave de produção do Asaas não pode ser utilizada com URL de Sandbox/i);
    });
  });

  describe('getPaymentStatus', () => {
    it('deve consultar e mapear status do pagamento no Asaas', async () => {
      vi.spyOn(asaasClient, 'getPayment').mockResolvedValueOnce({
        id: 'pay_test_999',
        customer: 'cus_test_123',
        billingType: 'PIX',
        status: 'RECEIVED',
        value: 150.0,
        netValue: 148.0,
        dateCreated: '2026-09-18',
        dueDate: '2026-09-19',
        confirmedDate: '2026-09-18T14:30:00Z',
      });

      const result = await adapter.getPaymentStatus('pay_test_999');
      expect(result.paymentId).toBe('pay_test_999');
      expect(result.status).toBe('RECEIVED');
      expect(result.paidAt).toBeInstanceOf(Date);
      expect(result.value).toBe(150);
      expect(result.netValue).toBe(148);
    });
  });

  describe('findPaymentsByReference', () => {
    it('maps every payment found for the stable external reference', async () => {
      vi.spyOn(asaasClient, 'findPaymentsByExternalReference').mockResolvedValueOnce([{
        id: 'pay_reference_1', customer: 'cus_test_123', billingType: 'PIX',
        status: 'CONFIRMED', value: 150, netValue: 148,
        dateCreated: '2026-09-29', dueDate: '2026-09-30',
        externalReference: 'payment-reference-uuid-1',
        confirmedDate: '2026-09-29T12:00:00Z',
      }]);

      const result = await adapter.findPaymentsByReference('payment-reference-uuid-1');

      expect(asaasClient.findPaymentsByExternalReference)
        .toHaveBeenCalledWith('payment-reference-uuid-1');
      expect(result).toEqual([expect.objectContaining({
        paymentId: 'pay_reference_1', status: 'CONFIRMED',
        externalReference: 'payment-reference-uuid-1', billingType: 'PIX', value: 150,
      })]);
    });

    it('uses the provider list endpoint with an encoded externalReference', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        object: 'list', hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
      vi.stubGlobal('fetch', fetchMock);
      const client = new AsaasClient('https://sandbox.asaas.com/api/v3', 'sandbox-test-key');

      await client.findPaymentsByExternalReference('reference/with spaces');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://sandbox.asaas.com/api/v3/payments?externalReference=reference%2Fwith%20spaces&limit=10&offset=0',
        expect.objectContaining({ method: 'GET' })
      );
      vi.unstubAllGlobals();
    });
  });

  describe('refunds', () => {
    it('envia o comando uma vez e lista o estado autoritativo dos estornos', async () => {
      vi.spyOn(asaasClient, 'refundPayment').mockResolvedValueOnce({
        id: 'pay_test_999', customer: 'cus_test_123', billingType: 'PIX',
        status: 'REFUND_IN_PROGRESS', value: 150, netValue: 148,
        dateCreated: '2026-09-29', dueDate: '2026-09-30',
      } as any);
      vi.spyOn(asaasClient, 'listPaymentRefunds').mockResolvedValueOnce([{
        dateCreated: '2026-09-29 12:00:00', status: 'DONE', value: 50,
        description: 'refund:intent-1',
      }]);

      const requested = await adapter.requestRefund({
        paymentId: 'pay_test_999', value: 50, description: 'refund:intent-1',
      });
      const refunds = await adapter.listPaymentRefunds('pay_test_999');

      expect(asaasClient.refundPayment).toHaveBeenCalledWith('pay_test_999', {
        value: 50, description: 'refund:intent-1',
      });
      expect(requested).toMatchObject({ paymentId: 'pay_test_999', status: 'REFUND_IN_PROGRESS' });
      expect(refunds).toEqual([expect.objectContaining({
        status: 'DONE', value: 50, description: 'refund:intent-1',
      })]);
    });
  });

  describe('Validação Zod de Checkout (Obrigatoriedade de CPF/CNPJ)', () => {
    const validBasePayload = {
      lojaID: 'loja-continental',
      customer: {
        name: 'Maria Santos',
        email: 'maria@santos.com',
        phone: '11988887777',
      },
      items: [
        {
          productId: 'prod-cera-1',
          name: 'Cera Automotiva',
          quantity: 1,
          price: 89.9,
        },
      ],
      deliveryType: 'PICKUP' as const,
    };

    it('deve rejeitar checkout se CPF/CNPJ não for fornecido', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const cpfError = result.error.issues.find((e) => e.path.includes('cpfCnpj'));
        expect(cpfError).toBeDefined();
      }
    });

    it('deve rejeitar checkout com CPF matematicamente inválido', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: '111.111.111-11', // CPF com dígitos repetidos
        },
      });

      expect(result.success).toBe(false);
    });

    it('deve aceitar checkout com CPF matematicamente válido formatado', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: '529.982.247-25', // CPF válido oficial
        },
      });

      expect(result.success).toBe(true);
    });

    it('deve aceitar checkout com CNPJ matematicamente válido formatado', () => {
      // CNPJ de teste matematicamente válido
      const validCnpj = '11.222.333/0001-81';
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: validCnpj,
        },
      });

      expect(result.success).toBe(true);
    });
  });
});
