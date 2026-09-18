import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { tenantCache } from '@/lib/cache';
import { getAggregatedDashboardMetrics, invalidateDashboardCache } from '@/services/dashboard.service';
import { OrderStatus, DeliveryType, Prisma } from '@prisma/client';

// Mock do prisma
vi.mock('@/lib/prisma', () => {
  return {
    default: {
      loja: {
        findUnique: vi.fn(),
      },
      order: {
        groupBy: vi.fn(),
        aggregate: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      product: {
        count: vi.fn(),
      },
      user: {
        count: vi.fn(),
      },
      freightRule: {
        count: vi.fn(),
      },
      jtExpressRate: {
        count: vi.fn(),
      },
      loyaltyWallet: {
        aggregate: vi.fn(),
        count: vi.fn(),
      },
      loyaltyTransaction: {
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
    },
  };
});

describe('Dashboard Service — Agregação e Cache Multi-Tenant (Fase 1)', () => {
  const mockLojaID = 'tenant-continental-123';

  beforeEach(() => {
    vi.clearAllMocks();
    tenantCache.clear();
  });

  it('deve lançar erro se lojaID não for fornecido', async () => {
    await expect(getAggregatedDashboardMetrics('')).rejects.toThrow(
      'lojaID é obrigatório para consultar métricas.'
    );
  });

  it('deve agregar métricas financeiras, logísticas e de fidelidade corretamente', async () => {
    // 1. Mock de Loja
    (prisma.loja.findUnique as any).mockResolvedValue({
      id: mockLojaID,
      name: 'Continental Estética Automotiva',
      originCep: '67140615',
      enableCorreios: true,
      enablePickup: true,
      enableNoFreight: true,
      pixKey: '12345678000199',
      pixKeyType: 'CNPJ',
      whatsappNumber: '5591999999999',
      loyaltyEnabled: true,
      loyaltyEarnRate: new Prisma.Decimal(0.5),
      loyaltyPointValue: new Prisma.Decimal(0.05),
      loyaltyMinPointsRedeem: 100,
      loyaltyMaxDiscountPct: new Prisma.Decimal(50),
      loyaltyPointsExpiryDays: 365,
    });

    // 2. Mock de Order GroupBy (Financeiro)
    (prisma.order.groupBy as any)
      .mockResolvedValueOnce([
        {
          status: OrderStatus.PAID,
          _count: { _all: 3 },
          _sum: {
            total: new Prisma.Decimal(980.0),
            shippingCost: new Prisma.Decimal(65.0),
          },
        },
        {
          status: OrderStatus.PENDING,
          _count: { _all: 12 },
          _sum: {
            total: new Prisma.Decimal(1435.99),
            shippingCost: new Prisma.Decimal(80.0),
          },
        },
        {
          status: OrderStatus.CANCELLED,
          _count: { _all: 10 },
          _sum: {
            total: new Prisma.Decimal(500.0),
            shippingCost: new Prisma.Decimal(0),
          },
        },
      ])
      // 3. Mock de Order GroupBy (Logística por carrier e tipo)
      .mockResolvedValueOnce([
        {
          deliveryType: DeliveryType.DELIVERY,
          shippingProvider: 'CORREIOS',
          _count: { _all: 2 },
          _sum: { shippingCost: new Prisma.Decimal(45.0) },
        },
        {
          deliveryType: DeliveryType.PICKUP,
          shippingProvider: 'STORE_PICKUP',
          _count: { _all: 1 },
          _sum: { shippingCost: new Prisma.Decimal(0) },
        },
      ]);

    // Mock de Order Aggregate (Hoje e Mês)
    (prisma.order.aggregate as any)
      .mockResolvedValueOnce({
        _sum: { total: new Prisma.Decimal(320.0), shippingCost: new Prisma.Decimal(20.0) },
        _count: { _all: 1 },
      }) // Hoje
      .mockResolvedValueOnce({
        _sum: { total: new Prisma.Decimal(980.0), shippingCost: new Prisma.Decimal(65.0) },
        _count: { _all: 3 },
      }); // Mês

    // 4. Mock de counts do Inbox Operacional
    (prisma.order.count as any)
      .mockResolvedValueOnce(2) // Awaiting dispatch
      .mockResolvedValueOnce(1) // Awaiting pickup
      .mockResolvedValueOnce(12); // Pending pix

    // 5. Mock de pedidos urgentes
    (prisma.order.findMany as any)
      .mockResolvedValueOnce([
        {
          id: 'ord-1',
          orderNumber: 31,
          total: new Prisma.Decimal(49.99),
          createdAt: new Date('2026-09-14T10:00:00Z'),
          status: OrderStatus.PAID,
          deliveryType: DeliveryType.DELIVERY,
          shippingServiceName: 'PAC',
          trackingCode: null,
          user: { name: 'Cliente Teste', email: 'teste@ex.com', phone: '91999999999' },
        },
      ])
      // 6. Mock de 10 pedidos recentes
      .mockResolvedValueOnce([
        {
          id: 'ord-1',
          orderNumber: 31,
          total: new Prisma.Decimal(49.99),
          subtotal: new Prisma.Decimal(30.0),
          shippingCost: new Prisma.Decimal(19.99),
          createdAt: new Date('2026-09-14T10:00:00Z'),
          status: OrderStatus.PAID,
          deliveryType: DeliveryType.DELIVERY,
          shippingProvider: 'CORREIOS',
          shippingServiceName: 'PAC',
          trackingCode: null,
          pointsEarned: 15,
          pointsRedeemed: 0,
          pointsDiscountValue: new Prisma.Decimal(0),
          user: { id: 'usr-1', name: 'Cliente Teste', email: 'teste@ex.com', phone: '91999999999' },
        },
      ]);

    // 7. Mock de contadores de catálogo e usuários
    (prisma.product.count as any).mockResolvedValue(521);
    (prisma.user.count as any).mockResolvedValue(6);
    (prisma.freightRule.count as any).mockResolvedValue(0);
    (prisma.jtExpressRate.count as any).mockResolvedValue(5181);

    // 8. Mock de Fidelidade
    (prisma.loyaltyWallet.aggregate as any).mockResolvedValue({
      _sum: {
        balance: 1250,
        lifetimeEarn: 3500,
      },
    });
    (prisma.loyaltyWallet.count as any).mockResolvedValue(4);
    (prisma.loyaltyTransaction.aggregate as any).mockResolvedValue({
      _sum: {
        points: -500,
        monetaryValue: new Prisma.Decimal(25.0),
      },
    });
    (prisma.loyaltyTransaction.findMany as any).mockResolvedValue([]);

    // Executa a função do serviço
    const result = await getAggregatedDashboardMetrics(mockLojaID);

    // Asserções Financeiras
    expect(result.financial.settledRevenue).toBe(980.0);
    expect(result.financial.pendingRevenue).toBe(1435.99);
    expect(result.financial.cancelledRevenue).toBe(500.0);
    expect(result.financial.totalOrdersCount).toBe(25);
    expect(result.financial.paidOrdersCount).toBe(3);
    expect(result.financial.pendingOrdersCount).toBe(12);
    expect(result.financial.cancelledOrdersCount).toBe(10);
    expect(result.financial.averageTicket).toBe(326.67);
    expect(result.financial.paymentConversionRatePct).toBe(12);
    expect(result.financial.pixConfig.hasPixKey).toBe(true);
    expect(result.financial.pixConfig.pixKeyMasked).toBe('**.***.678/0001-**');

    // Asserções Financeiras
    expect(result.financial.settledTodayRevenue).toBe(320.0);
    expect(result.financial.settledTodayShipping).toBe(20.0);
    expect(result.financial.settledTodayNetRevenue).toBe(300.0);
    expect(result.financial.settledTodayOrdersCount).toBe(1);

    expect(result.financial.settledMonthRevenue).toBe(980.0);
    expect(result.financial.settledMonthShipping).toBe(65.0);
    expect(result.financial.settledMonthNetRevenue).toBe(915.0);
    expect(result.financial.settledMonthOrdersCount).toBe(3);

    expect(result.financial.settledTotalRevenue).toBe(980.0);
    expect(result.financial.settledTotalShipping).toBe(65.0);
    expect(result.financial.settledTotalNetRevenue).toBe(915.0);
    expect(result.financial.settledTotalOrdersCount).toBe(3);
    expect(result.financial.settledRevenue).toBe(980.0);
    expect(result.financial.pendingRevenue).toBe(1435.99);
    expect(result.financial.cancelledRevenue).toBe(500.0);
    expect(result.financial.averageTicket).toBe(326.67);
    expect(result.financial.paymentConversionRatePct).toBe(12);

    // Asserções de Logística
    expect(result.logistics.totalShippingRevenue).toBe(45.0);
    expect(result.logistics.deliveryOrdersCount).toBe(2);
    expect(result.logistics.pickupOrdersCount).toBe(1);
    expect(result.logistics.providerStatus.enableCorreios).toBe(true);
    expect(result.logistics.providerStatus.hasJtExpressMatrix).toBe(true);

    // Asserções de Fidelidade
    expect(result.loyalty.loyaltyEnabled).toBe(true);
    expect(result.loyalty.totalCirculatingPoints).toBe(1250);
    expect(result.loyalty.projectedFinancialLiability).toBe(62.5);
    expect(result.loyalty.totalRedeemedPoints).toBe(500);
    expect(result.loyalty.totalRedeemedMonetaryDiscount).toBe(25.0);
    expect(result.loyalty.activeWalletsCount).toBe(4);

    // Asserções de Catálogo e Clientes (Inalterados)
    expect(result.catalog.totalProducts).toBe(521);
    expect(result.catalog.totalCustomers).toBe(6);

    // Asserções do Inbox Operacional
    expect(result.inbox.ordersAwaitingDispatchCount).toBe(2);
    expect(result.inbox.ordersAwaitingPickupCount).toBe(1);
    expect(result.inbox.ordersPendingPixCount).toBe(12);
    expect(result.inbox.urgentItems).toHaveLength(1);
    expect(result.inbox.urgentItems[0].reason).toBe('AWAITING_DISPATCH');

    // Asserções de Pedidos Recentes
    expect(result.recentOrders).toHaveLength(1);
    expect(result.recentOrders[0].isAwaitingDispatch).toBe(true);
  });

  it('deve usar o cache tenant-aware em chamadas subsequentes e respeitar a invalidação', async () => {
    (prisma.loja.findUnique as any).mockResolvedValue({
      id: mockLojaID,
      name: 'Continental',
      loyaltyPointValue: new Prisma.Decimal(0.05),
    });
    (prisma.order.groupBy as any).mockResolvedValue([]);
    (prisma.order.aggregate as any).mockResolvedValue({ _sum: { total: null }, _count: { _all: 0 } });
    (prisma.order.count as any).mockResolvedValue(0);
    (prisma.order.findMany as any).mockResolvedValue([]);
    (prisma.product.count as any).mockResolvedValue(10);
    (prisma.user.count as any).mockResolvedValue(5);
    (prisma.freightRule.count as any).mockResolvedValue(0);
    (prisma.jtExpressRate.count as any).mockResolvedValue(0);
    (prisma.loyaltyWallet.aggregate as any).mockResolvedValue({ _sum: { balance: 0, lifetimeEarn: 0 } });
    (prisma.loyaltyWallet.count as any).mockResolvedValue(0);
    (prisma.loyaltyTransaction.aggregate as any).mockResolvedValue({ _sum: { points: 0, monetaryValue: null } });
    (prisma.loyaltyTransaction.findMany as any).mockResolvedValue([]);

    // Primeira chamada: consulta banco
    const first = await getAggregatedDashboardMetrics(mockLojaID);
    expect(prisma.loja.findUnique).toHaveBeenCalledTimes(1);

    // Segunda chamada: vem do cache
    const second = await getAggregatedDashboardMetrics(mockLojaID);
    expect(prisma.loja.findUnique).toHaveBeenCalledTimes(1);
    expect(second.generatedAt).toBe(first.generatedAt);

    // Invalidação de cache
    invalidateDashboardCache(mockLojaID);

    // Terceira chamada: consulta banco novamente
    await getAggregatedDashboardMetrics(mockLojaID);
    expect(prisma.loja.findUnique).toHaveBeenCalledTimes(2);
  });
});
