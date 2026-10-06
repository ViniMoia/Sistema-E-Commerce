import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerSchema } from '@/lib/validators/auth';
import { registerUser } from '@/services/auth.service';
import { createOrder } from '@/tests/helpers/checkout-domain-fixture';
import { listCustomers, getCustomerProfile } from '@/services/customer.service';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

vi.mock('@/lib/prisma', async () => {
  const { paymentAttemptFixture } = await import('@/tests/helpers/payment-fixture-mock');
  return {
    default: {
      paymentAttempt: paymentAttemptFixture(),
      $queryRaw: vi.fn().mockResolvedValue([]),
      orderBuyer: { create: vi.fn(async ({ data }: any) => ({ id: "buyer-1", ...data })) },
      $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : cb)),
      loja: {
        findUnique: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
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

describe('Persistência e Ciclo de Vida de CPF/CNPJ (REV-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Validação de Entrada (registerSchema)', () => {
    it('deve aceitar cadastro com CPF válido formatado', () => {
      // CPF válido matemático gerado para teste
      const validCpf = '52998224725'; // ou formatado
      const res = registerSchema.safeParse({
        name: 'Cliente Teste',
        email: 'cliente@teste.com',
        password: 'password123',
        cpfCnpj: '529.982.247-25',
      });
      expect(res.success).toBe(true);
    });

    it('deve aceitar cadastro com CNPJ válido formatado', () => {
      const validCnpj = '11.222.333/0001-81';
      const res = registerSchema.safeParse({
        name: 'Empresa Teste',
        email: 'empresa@teste.com',
        password: 'password123',
        cpfCnpj: validCnpj,
      });
      expect(res.success).toBe(true);
    });

    it('deve rejeitar CPF com dígitos verificadores inválidos', () => {
      const res = registerSchema.safeParse({
        name: 'Cliente Fraude',
        email: 'fraude@teste.com',
        password: 'password123',
        cpfCnpj: '111.222.333-99', // Dígitos verificadores incorretos
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.flatten().fieldErrors.cpfCnpj).toContain('CPF ou CNPJ inválido');
      }
    });

    it('deve aceitar cadastro sem CPF/CNPJ (campo opcional)', () => {
      const res = registerSchema.safeParse({
        name: 'Cliente Sem Documento',
        email: 'semdoc@teste.com',
        password: 'password123',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('2. Persistência no Cadastro (registerUser)', () => {
    it('deve sanitizar o CPF/CNPJ removendo pontuações e gravar somente dígitos no banco', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({ id: 'loja-1' } as any);
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'usr-1',
        name: 'João Silva',
        email: 'joao@silva.com',
        phone: '11999998888',
        cpfCnpj: '52998224725',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        lojaID: 'loja-1',
        addresses: [],
      } as any);

      const user = await registerUser({
        name: 'João Silva',
        email: 'joao@silva.com',
        password: 'minhasenhasupersafada',
        phone: '(11) 99999-8888',
        cpfCnpj: '529.982.247-25',
        lojaID: 'loja-1',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cpfCnpj: '52998224725',
          }),
        })
      );
      expect(user.cpfCnpj).toBe('52998224725');
    });

    it('deve gravar null em cpfCnpj quando não for informado no cadastro', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({ id: 'loja-1' } as any);
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'usr-2',
        name: 'Sem CPF',
        email: 'semcpf@teste.com',
        phone: null,
        cpfCnpj: null,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        lojaID: 'loja-1',
        addresses: [],
      } as any);

      await registerUser({
        name: 'Sem CPF',
        email: 'semcpf@teste.com',
        password: 'minhasenhasupersafada',
        lojaID: 'loja-1',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cpfCnpj: null,
          }),
        })
      );
    });
  });

  describe('3. Persistência no Checkout e Snapshot Histórico no Pedido (createOrder)', () => {
    it('deve persistir CPF no comprador/pedido convidado sem criar ou atualizar User', async () => {
      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
        id: 'loja-1',
        name: 'Loja Teste',
        pixKey: 'minha-chave-pix',
      } as any);

      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        name: 'Cera Automotiva',
        price: new Prisma.Decimal('80.00'),
        stock: 10,
        lojaID: 'loja-1',
        productVariants: [{ id: 'fixture-neutral-variant', size: 'Único', color: 'Padrão', stock: 100 }],
      } as any);

      vi.mocked(prisma.freightRule.findFirst).mockResolvedValueOnce({
        id: 'fr-1',
        lojaID: 'loja-1',
        cityName: 'Curitiba',
        value: new Prisma.Decimal('15.00'),
        minDays: 1,
        maxDays: 3,
      } as any);

      vi.mocked(prisma.address.create).mockResolvedValueOnce({ id: 'addr-1' } as any);

      (prisma.order.create as any).mockImplementationOnce(async ({ data }: any) => ({
        id: 'ord-snapshot-123',
        orderNumber: 2001,
        total: data.total,
        subtotal: data.subtotal,
        shippingCost: data.shippingCost,
        freightValue: data.freightValue,
        pixKeyUsed: data.pixKeyUsed,
        deliveryType: data.deliveryType,
        customerCpfCnpj: data.customerCpfCnpj,
        pointsRedeemed: 0,
        pointsDiscountValue: new Prisma.Decimal(0),
        user: { name: 'Comprador Exemplo', phone: '41988887777', cpfCnpj: '52998224725' },
        items: (data.items?.create || []).map((i: any) => ({
          productId: i.product?.connect?.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
      }));

      const result = await createOrder({
      paymentMethod: 'WHATSAPP_PIX',
        lojaID: 'loja-1',
        customer: {
          name: 'Comprador Exemplo',
          email: 'comprador@exemplo.com',
          phone: '(41) 98888-7777',
          cpfCnpj: '529.982.247-25', // Com máscara
        },
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryType: 'DELIVERY', freightQuoteToken: 'authorized-fixture-quote', freightOwnerKey: 'g:' + 'a'.repeat(64),
        address: {
          cep: '80000-000',
          state: 'PR',
          city: 'Curitiba',
          neighborhood: 'Centro',
          street: 'Rua XV',
          number: '100',
        },
      });

      expect(result.success).toBe(true);

      // Dados declarados ficam no snapshot; nunca concedem autoridade sobre User.
      expect(prisma.user.upsert).not.toHaveBeenCalled();
      expect(prisma.orderBuyer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authenticatedUserID: null,
            cpfCnpj: '52998224725',
          }),
        })
      );

      // Verifica que o Order.create salvou o snapshot imutável customerCpfCnpj
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerCpfCnpj: '52998224725',
          }),
        })
      );

      // Verifica que o resultado retornado ao cliente contém o CPF/CNPJ
      expect(result.order.customer.cpfCnpj).toBe('52998224725');
    });
  });

  describe('4. Exposição em Serviços de Cliente (listCustomers & getCustomerProfile)', () => {
    it('deve mapear e retornar cpfCnpj em CustomerRow no listCustomers', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        {
          id: 'usr-10',
          name: 'Cliente Auditado',
          email: 'auditado@cliente.com',
          phone: '11977776666',
          cpfCnpj: '52998224725',
          createdAt: new Date('2026-09-01T10:00:00Z'),
          orders: [{ total: new Prisma.Decimal('150.00'), createdAt: new Date() }],
        },
      ] as any);

      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{
        userID: 'usr-10', totalOrders: BigInt(1), recognizedOrderCount: BigInt(0), unverifiedOrders: BigInt(1),
        financialReviewOrders: BigInt(0), cancelledOrders: BigInt(0), totalOrderValue: new Prisma.Decimal(150),
        totalMerchandiseOrdered: new Prisma.Decimal(150), recognizedGross: new Prisma.Decimal(0), settledGross: new Prisma.Decimal(0),
        confirmedRefunds: new Prisma.Decimal(0), totalSpent: new Prisma.Decimal(0), averageOrderValue: new Prisma.Decimal(0),
        firstOrderAt: null, lastOrderAt: null, asOf: new Date(), recognizedActiveOrderIds: [],
      }]);
      const { data } = await listCustomers({ lojaID: 'loja-1' });

      expect(data).toHaveLength(1);
      expect(data[0].cpfCnpj).toBe('52998224725');
    });

    it('deve mapear e retornar cpfCnpj em CustomerProfile no getCustomerProfile', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'usr-20',
        name: 'Perfil Completo',
        email: 'perfil@cliente.com',
        phone: '11977776666',
        cpfCnpj: '11222333000181',
        createdAt: new Date('2026-09-01T10:00:00Z'),
        addresses: [],
      } as any);

      const profile = await getCustomerProfile({ customerId: 'usr-20', lojaID: 'loja-1' });

      expect(profile).not.toBeNull();
      expect(profile?.cpfCnpj).toBe('11222333000181');
    });
  });
});

vi.mock('@/lib/freight/acceptance', async () => {
  const { freightAcceptanceMock } = await import('@/tests/helpers/freight-acceptance-mock');
  return freightAcceptanceMock(0);
});

vi.mock('@/services/payment/capabilities.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/payment/capabilities.service')>();
  const { completePaymentStore } = await import('@/tests/helpers/payment-fixture-mock');
  return { paymentCapabilities: (store: Parameters<typeof actual.paymentCapabilities>[0], gateway: Parameters<typeof actual.paymentCapabilities>[1]) => actual.paymentCapabilities(completePaymentStore(store), gateway) };
});

vi.mock('@/services/checkout-intent.service', async importOriginal => {
  const { intentUnitMock } = await import('@/tests/helpers/checkout-domain-fixture');
  return intentUnitMock(await importOriginal<typeof import('@/services/checkout-intent.service')>());
});
vi.mock('@/services/checkout-plan.service', async importOriginal => {
  const { planUnitMock } = await import('@/tests/helpers/checkout-domain-fixture');
  return planUnitMock(await importOriginal<typeof import('@/services/checkout-plan.service')>());
});
