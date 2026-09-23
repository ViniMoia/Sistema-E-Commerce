import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
import { asaasClient, AsaasClientError } from '@/services/asaas/asaas.client';
import { validateLuhn, creditCardSchema } from '@/lib/validators/checkout.validators';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { createOrder } from '@/services/checkout.service';

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : cb)),
      loja: {
        findUnique: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      productVariants: {
        update: vi.fn(),
      },
      freightRule: {
        findFirst: vi.fn(),
      },
      user: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
      },
      address: {
        create: vi.fn(),
      },
      order: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

describe('Meio de Pagamento: Cartão de Crédito (Asaas & Checkout)', () => {
  let adapter: AsaasPaymentAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AsaasPaymentAdapter();
    process.env.ASAAS_API_KEY = '$aact_test_key_mock_123';
  });

  describe('1. Validações Locais de Cartão (Luhn e Schemas)', () => {
    it('deve validar números de cartão válidos e rejeitar inválidos com algoritmo de Luhn', () => {
      // 4532015112830366 é um número de teste clássico válido no algoritmo de Luhn (16 dígitos)
      expect(validateLuhn('4532015112830366')).toBe(true);
      // Número com dígito verificador adulterado
      expect(validateLuhn('4532015112830367')).toBe(false);
      // Sequência curta
      expect(validateLuhn('12345')).toBe(false);
    });

    it('deve aceitar cartão com data de validade futura e número válido', () => {
      const currentYear = new Date().getFullYear();
      const validCard = {
        holderName: 'CARLOS SILVA',
        number: '4532015112830366',
        expiryMonth: '12',
        expiryYear: String(currentYear + 2),
        ccv: '123',
      };

      const result = creditCardSchema.safeParse(validCard);
      expect(result.success).toBe(true);
    });

    it('deve rejeitar cartão com data de validade expirada', () => {
      const expiredCard = {
        holderName: 'CARLOS SILVA',
        number: '4532015112830366',
        expiryMonth: '01',
        expiryYear: '2020',
        ccv: '123',
      };

      const result = creditCardSchema.safeParse(expiredCard);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('expirada');
      }
    });

    it('deve rejeitar código CVV com menos de 3 dígitos', () => {
      const invalidCvv = {
        holderName: 'CARLOS SILVA',
        number: '4532015112830366',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '12',
      };

      const result = creditCardSchema.safeParse(invalidCvv);
      expect(result.success).toBe(false);
    });
  });

  describe('2. AsaasPaymentAdapter: createCreditCardCharge', () => {
    it('deve enviar payload completo para o Asaas e retornar resultado com bandeira e final', async () => {
      vi.spyOn(asaasClient, 'getOrCreateCustomer').mockResolvedValueOnce('cus_cc_123');
      vi.spyOn(asaasClient, 'createPayment').mockResolvedValueOnce({
        id: 'pay_cc_777',
        customer: 'cus_cc_123',
        billingType: 'CREDIT_CARD',
        status: 'CONFIRMED',
        value: 120.0,
        netValue: 115.0,
        dateCreated: '2026-09-23',
        dueDate: '2026-09-23',
        creditCard: {
          creditCardBrand: 'MASTERCARD',
          creditCardNumber: '8431',
        },
        invoiceUrl: 'https://asaas.com/i/cc777',
      });

      const result = await adapter.createCreditCardCharge({
        orderId: 'ord-cc-1',
        orderNumber: 2001,
        value: 120.0,
        customer: {
          name: 'Maria Oliveira',
          email: 'maria@oliveira.com',
          phone: '(11) 97777-8888',
          cpfCnpj: '529.982.247-25',
          postalCode: '01310-100',
          addressNumber: '1000',
        },
        creditCard: {
          holderName: 'MARIA OLIVEIRA',
          number: '5500000000008431',
          expiryMonth: '08',
          expiryYear: '2029',
          ccv: '987',
        },
        installmentCount: 3,
        installmentValue: 40.0,
      });

      expect(result.paymentId).toBe('pay_cc_777');
      expect(result.status).toBe('CONFIRMED');
      expect(result.creditCardBrand).toBe('MASTERCARD');
      expect(result.creditCardLast4).toBe('8431');
      expect(result.invoiceUrl).toBe('https://asaas.com/i/cc777');
    });

    it('deve converter recusa do Asaas em PaymentGatewayError descritivo', async () => {
      vi.spyOn(asaasClient, 'getOrCreateCustomer').mockResolvedValueOnce('cus_cc_123');
      vi.spyOn(asaasClient, 'createPayment').mockRejectedValueOnce(
        new AsaasClientError('Transação não autorizada', 400, [
          { code: 'card_declined', description: 'Transação não autorizada pelo banco emissor (saldo insuficiente).' },
        ])
      );

      await expect(
        adapter.createCreditCardCharge({
          orderId: 'ord-cc-fail',
          orderNumber: 2002,
          value: 80.0,
          customer: {
            name: 'Teste Falha',
            email: 'falha@teste.com',
            phone: '11999999999',
            cpfCnpj: '529.982.247-25',
          },
          creditCard: {
            holderName: 'TESTE FALHA',
            number: '4532015112830366',
            expiryMonth: '11',
            expiryYear: '2028',
            ccv: '123',
          },
        })
      ).rejects.toThrow('saldo insuficiente');
    });
  });

  describe('3. Orquestração de Checkout com Cartão de Crédito', () => {
    it('deve bloquear previamente transações com valor inferior ao piso de R$ 5,00', async () => {
      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
        id: 'loja-cc-test',
        name: 'Continental Teste',
        pixKey: 'pix@continental.com',
      } as any);

      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: 'prod-barato',
        name: 'Amostra Grátis',
        price: new Prisma.Decimal('2.00'),
        stock: 10,
        lojaID: 'loja-cc-test',
        productVariants: [],
      } as any);

      const mockUser = { id: 'usr-1', name: 'Comprador', email: 'c@t.com', phone: '11999999999' };
      vi.mocked(prisma.user.upsert).mockResolvedValueOnce(mockUser as any);

      vi.mocked(prisma.order.create).mockResolvedValueOnce({
        id: 'ord-barato-1',
        orderNumber: 5001,
        lojaID: 'loja-cc-test',
        userID: 'usr-1',
        total: new Prisma.Decimal('2.00'),
        subtotal: new Prisma.Decimal('2.00'),
        freightValue: null,
        shippingCost: new Prisma.Decimal('0.00'),
        shippingProvider: 'STORE_PICKUP',
        shippingServiceName: 'Retirada na Loja',
        shippingEstimatedDays: 0,
        status: 'PENDING',
        paymentMethod: 'CREDIT_CARD',
        pixKeyUsed: null,
        pointsEarned: 0,
        pointsRedeemed: 0,
        pointsDiscountValue: new Prisma.Decimal('0.00'),
        deliveryType: 'PICKUP',
        user: mockUser,
        items: [],
      } as any);

      vi.mocked(prisma.order.update).mockResolvedValue({} as any);

      // Total R$ 2,00 < piso de R$ 5,00 do Asaas
      await expect(
        createOrder({
          lojaID: 'loja-cc-test',
          customer: {
            name: 'Comprador',
            email: 'c@t.com',
            phone: '11999999999',
            cpfCnpj: '52998224725',
          },
          items: [{ productId: 'prod-barato', quantity: 1, price: 2.0 }],
          deliveryType: 'PICKUP',
          paymentMethod: 'CREDIT_CARD',
          creditCard: {
            holderName: 'COMPRADOR',
            number: '4532015112830366',
            expiryMonth: '12',
            expiryYear: '2028',
            ccv: '123',
          },
        })
      ).rejects.toThrow('R$ 5,00');
    });
  });
});
