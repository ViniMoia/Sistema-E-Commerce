import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsaasClient, AsaasClientError, asaasClient } from '@/services/asaas/asaas.client';
import { createOrder } from '@/services/checkout.service';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : cb)),
      loja: {
        findUnique: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
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
      },
      address: {
        create: vi.fn(),
      },
      order: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  };
});

describe('Asaas Customer Lifecycle & Integration (REV-002)', () => {
  const originalEnv = process.env;
  let mockFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
      ASAAS_API_KEY: 'test-api-key',
    };
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('AsaasClient.findCustomerByEmail', () => {
    it('deve retornar o primeiro cliente ativo correspondente ao e-mail', async () => {
      const client = new AsaasClient();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          hasMore: false,
          totalCount: 1,
          data: [
            {
              id: 'cus_000005912345',
              name: 'João Silva',
              email: 'joao@example.com',
              deleted: false,
            },
          ],
        }),
      });

      const customer = await client.findCustomerByEmail('joao@example.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sandbox.asaas.com/api/v3/customers?email=joao%40example.com',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            access_token: 'test-api-key',
          }),
        })
      );
      expect(customer).not.toBeNull();
      expect(customer?.id).toBe('cus_000005912345');
    });

    it('deve ignorar clientes marcados como deleted: true e retornar null se nenhum ativo for encontrado', async () => {
      const client = new AsaasClient();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          hasMore: false,
          totalCount: 1,
          data: [
            {
              id: 'cus_deleted_999',
              name: 'Cliente Deletado',
              email: 'deletado@example.com',
              deleted: true,
            },
          ],
        }),
      });

      const customer = await client.findCustomerByEmail('deletado@example.com');
      expect(customer).toBeNull();
    });

    it('deve retornar null se data for vazia', async () => {
      const client = new AsaasClient();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          hasMore: false,
          totalCount: 0,
          data: [],
        }),
      });

      const customer = await client.findCustomerByEmail('inexistente@example.com');
      expect(customer).toBeNull();
    });

    it('deve lançar AsaasClientError se o endpoint retornar erro HTTP', async () => {
      const client = new AsaasClient();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          errors: [{ code: 'invalid_token', description: 'Chave de API inválida' }],
        }),
      });

      await expect(client.findCustomerByEmail('teste@example.com')).rejects.toThrow(
        AsaasClientError
      );
    });
  });

  describe('AsaasClient.createCustomer', () => {
    it('deve sanitizar telefone e CPF/CNPJ (removendo caracteres especiais) e criar cliente com sucesso', async () => {
      const client = new AsaasClient();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'cus_novo_78910',
          name: 'Maria Santos',
          email: 'maria@example.com',
          phone: '11987654321',
          mobilePhone: '11987654321',
          cpfCnpj: '12345678901',
        }),
      });

      const created = await client.createCustomer({
        name: 'Maria Santos',
        email: 'MARIA@EXAMPLE.COM ',
        phone: '(11) 98765-4321',
        mobilePhone: '+55 (11) 98765-4321',
        cpfCnpj: '123.456.789-01',
        notificationDisabled: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sandbox.asaas.com/api/v3/customers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Maria Santos',
            email: 'maria@example.com',
            phone: '11987654321',
            mobilePhone: '5511987654321',
            cpfCnpj: '12345678901',
            notificationDisabled: true,
          }),
        })
      );
      expect(created.id).toBe('cus_novo_78910');
    });

    it('deve lançar AsaasClientError com código e detalhes se criação falhar', async () => {
      const client = new AsaasClient();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          errors: [{ code: 'invalid_cpfCnpj', description: 'CPF inválido' }],
        }),
      });

      await expect(
        client.createCustomer({
          name: 'Erro Teste',
          email: 'erro@teste.com',
        })
      ).rejects.toThrow(AsaasClientError);
    });
  });

  describe('AsaasClient.getOrCreateCustomer', () => {
    it('deve retornar ID de cliente existente sem disparar POST /customers', async () => {
      const client = new AsaasClient();
      const spyFind = vi.spyOn(client, 'findCustomerByEmail').mockResolvedValueOnce({
        id: 'cus_existente_999',
        name: 'Cliente Já Existente',
        email: 'existente@example.com',
      });
      const spyCreate = vi.spyOn(client, 'createCustomer');

      const customerId = await client.getOrCreateCustomer({
        name: 'Cliente Já Existente',
        email: 'existente@example.com',
      });

      expect(spyFind).toHaveBeenCalledWith('existente@example.com');
      expect(spyCreate).not.toHaveBeenCalled();
      expect(customerId).toBe('cus_existente_999');
    });

    it('deve criar novo cliente e retornar o novo ID se o cliente não existir previamente', async () => {
      const client = new AsaasClient();
      const spyFind = vi.spyOn(client, 'findCustomerByEmail').mockResolvedValueOnce(null);
      const spyCreate = vi.spyOn(client, 'createCustomer').mockResolvedValueOnce({
        id: 'cus_recem_criado_111',
        name: 'Novo Cliente',
        email: 'novo@example.com',
      });

      const customerId = await client.getOrCreateCustomer({
        name: 'Novo Cliente',
        email: 'novo@example.com',
        phone: '11999998888',
      });

      expect(spyFind).toHaveBeenCalledWith('novo@example.com');
      expect(spyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'novo@example.com',
        })
      );
      expect(customerId).toBe('cus_recem_criado_111');
    });
  });

  describe('CheckoutService.createOrder - Integração Asaas Customer', () => {
    it('deve resolver o customerId oficial (cus_...) via getOrCreateCustomer e passá-lo para createPayment', async () => {
      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
        id: 'loja-1',
        name: 'Loja Teste',
        pixKey: 'minha-chave-pix',
      } as any);

      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: 'prod-100',
        name: 'Produto Teste',
        price: new Prisma.Decimal('100.00'),
        stock: 5,
        lojaID: 'loja-1',
        productVariants: [],
      } as any);

      vi.mocked(prisma.freightRule.findFirst).mockResolvedValueOnce({
        id: 'fr-1',
        lojaID: 'loja-1',
        cityName: 'São Paulo',
        value: new Prisma.Decimal('20.00'),
        minDays: 2,
        maxDays: 4,
      } as any);

      vi.mocked(prisma.user.upsert).mockResolvedValueOnce({
        id: 'user-1',
        name: 'Carlos Cliente',
        email: 'carlos@cliente.com',
        phone: '11988887777',
      } as any);

      vi.mocked(prisma.address.create).mockResolvedValueOnce({
        id: 'addr-1',
      } as any);

      (prisma.order.create as any).mockImplementationOnce(async ({ data }: any) => ({
        id: 'order-123',
        orderNumber: 1050,
        total: data.total,
        subtotal: data.subtotal,
        shippingCost: data.shippingCost,
        freightValue: data.freightValue,
        pixKeyUsed: data.pixKeyUsed,
        deliveryType: data.deliveryType,
        pointsRedeemed: 0,
        pointsDiscountValue: new Prisma.Decimal('0.00'),
        user: { name: 'Carlos Cliente', phone: '11988887777' },
        items: (data.items?.create || []).map((i: any) => ({
          productId: i.product?.connect?.id || 'prod-100',
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
      }));

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'order-123',
        asaasPaymentId: 'pay_asaas_888',
        asaasPaymentStatus: 'PENDING',
      } as any);

      const spyGetOrCreate = vi
        .spyOn(asaasClient, 'getOrCreateCustomer')
        .mockResolvedValueOnce('cus_resolvido_555');

      const spyCreatePayment = vi
        .spyOn(asaasClient, 'createPayment')
        .mockResolvedValueOnce({
          id: 'pay_asaas_888',
          customer: 'cus_resolvido_555',
          dateCreated: '2026-09-16',
          dueDate: '2026-09-17',
          value: 120.0,
          netValue: 119.0,
          billingType: 'PIX',
          status: 'PENDING',
          invoiceUrl: 'https://asaas.com/i/888',
        });

      const spyGetPix = vi
        .spyOn(asaasClient, 'getPixQrCode')
        .mockResolvedValueOnce({
          encodedImage: 'base64_qr_code_sample',
          payload: '000201...pix_copia_e_cola',
          expirationDate: '2026-09-17 23:59:59',
        });

      const result = await createOrder({
        lojaID: 'loja-1',
        customer: {
          name: 'Carlos Cliente',
          email: 'carlos@cliente.com',
          phone: '(11) 98888-7777',
          cpfCnpj: '123.456.789-10',
        },
        items: [{ productId: 'prod-100', quantity: 1 }],
        deliveryType: 'DELIVERY',
        address: {
          cep: '01310-100',
          state: 'SP',
          city: 'São Paulo',
          neighborhood: 'Bela Vista',
          street: 'Av Paulista',
          number: '1000',
        },
      });

      // Verificações
      expect(result.success).toBe(true);
      expect(spyGetOrCreate).toHaveBeenCalledWith({
        name: 'Carlos Cliente',
        email: 'carlos@cliente.com',
        phone: '(11) 98888-7777',
        cpfCnpj: '123.456.789-10',
      });

      // GARANTIA: createPayment recebeu customer como ID oficial cus_resolvido_555, e NÃO e-mail!
      expect(spyCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_resolvido_555',
          billingType: 'PIX',
          value: 120,
          externalReference: 'order-123',
        })
      );
      expect(spyCreatePayment).not.toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'carlos@cliente.com',
        })
      );

      expect(result.order.asaasPaymentId).toBe('pay_asaas_888');
      expect(result.order.pixQrCode).toBe('base64_qr_code_sample');
      expect(result.order.pixPayload).toBe('000201...pix_copia_e_cola');
    });
  });
});
