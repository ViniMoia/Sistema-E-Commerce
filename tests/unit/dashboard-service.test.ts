import { readDashboardFinancial } from '@/services/dashboard-financial.service';
import { readLoyaltyReport } from '@/services/loyalty-report.service';
import type { DashboardFinancialEvidenceDTO } from '@/types/dashboard';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { tenantCache } from '@/lib/cache';
import { getAggregatedDashboardMetrics, invalidateDashboardCache } from '@/services/dashboard.service';
import { OrderStatus, DeliveryType, Prisma } from '@prisma/client';

vi.mock('@/services/dashboard-financial.service', () => ({ readDashboardFinancial: vi.fn() }));
vi.mock('@/services/loyalty-report.service', () => ({ readLoyaltyReport: vi.fn() }));
const loyaltyReport = {
  settings: { loyaltyEnabled: true, loyaltyEarnRate: 0.5, loyaltyPointValue: 0.05,
    loyaltyMinPointsRedeem: 100, loyaltyMaxDiscountPct: 50, loyaltyPointsExpiryDays: null },
  metrics: { totalCirculatingPoints: 1250, totalDebtPoints: 10, projectedFinancialLiability: 62.5,
    activeCustomersWithPoints: 4, totalLifetimeEarnedPoints: 0, legacyWallets: 1,
    totalRedeemedPoints: 500, totalRedeemedMonetaryValue: 25,
    commercial: { earnedPoints: 600, reversedEarnedPoints: 100, redeemedPoints: 500, returnedPoints: 200,
      netRedeemedPoints: 300, redeemedValue: 25, returnedValue: 10, netRedeemedValue: 15,
      missingMonetaryValues: 1, unlinkedTransactions: 0, coverage: 'PARTIAL' as const } },
  recentTransactions: Array.from({ length: 7 }, (_, i) => ({ id: `loyalty-${i}`, userName: 'Cliente',
    userEmail: 'customer@example.invalid', type: 'REDEEM', points: -10, balanceAfter: 0,
    monetaryValue: 0.5, description: 'Resgate registrado', orderId: `order-${i}`,
    isTestOrder: i === 0, createdAt: '2026-10-16T12:00:00.000Z' })),
} satisfies Awaited<ReturnType<typeof readLoyaltyReport>>;
const evidence = { policy: 'RECORDED_FINANCIAL_FACTS_V1', timeBasis: 'FACT_CREATED_AT', timezone: 'America/Sao_Paulo', currency: 'BRL', asOf: '2026-10-16T12:00:00.000Z', coverage: 'COMPLETE', unverifiedOrders: 0, financialReviewOrders: 0, today: { recognizedGross: 100, settledGross: 0, confirmedRefunds: 0, netRecognized: 100, recognizedOrderCount: 1, settledOrderCount: 0, refundedOrderCount: 0 }, month: { recognizedGross: 100, settledGross: 0, confirmedRefunds: 0, netRecognized: 100, recognizedOrderCount: 1, settledOrderCount: 0, refundedOrderCount: 0 }, allTime: { recognizedGross: 100, settledGross: 0, confirmedRefunds: 0, netRecognized: 100, recognizedOrderCount: 1, settledOrderCount: 0, refundedOrderCount: 0 }, composition: { merchandiseAfterDiscount: 100, shipping: 0, financingCharge: 0, unallocatedRecognized: 0 }, pendingOrderValue: 0, cancelledUnpaidOrderValue: 0, cancelledUnpaidOrderCount: 0, averageNetTicket: 100, totalOrdersCount: 1, paidOrdersCount: 1, pendingOrdersCount: 0, cancelledOrdersCount: 0, paymentConversionRatePct: 100 } satisfies DashboardFinancialEvidenceDTO;

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
    },
  };
});

describe('Dashboard Service — Agregação e Cache Multi-Tenant (Fase 1)', () => {
  const mockLojaID = 'tenant-continental-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readDashboardFinancial).mockResolvedValue(evidence);
    vi.mocked(readLoyaltyReport).mockResolvedValue(loyaltyReport);
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

    // Executa a função do serviço
    const result = await getAggregatedDashboardMetrics(mockLojaID);

    expect(readDashboardFinancial).toHaveBeenCalledWith(prisma, mockLojaID);
    expect(result.financial).toMatchObject(evidence);
    expect(result.financial.pixConfig.hasPixKey).toBe(true);
    expect(result.financial.pixConfig.pixKeyMasked).toBe('**.***.678/0001-**');

    // Asserções de Logística
    expect(result.logistics.totalShippingQuoted).toBe(45.0);
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
    expect(readLoyaltyReport).toHaveBeenCalledExactlyOnceWith(mockLojaID);
    expect(result.loyalty.commercial).toEqual(loyaltyReport.metrics.commercial);
    expect(result.loyalty.totalLifetimeEarnedPoints).toBe(0);
    expect(result.loyalty.totalDebtPoints).toBe(10);
    expect(result.loyalty.legacyWallets).toBe(1);
    expect(result.loyalty.settings.loyaltyPointsExpiryDays).toBeNull();
    expect(result.loyalty.recentTransactions).toEqual(loyaltyReport.recentTransactions.slice(0, 5));

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

    // Primeira chamada: consulta banco
    const first = await getAggregatedDashboardMetrics(mockLojaID);
    expect(prisma.loja.findUnique).toHaveBeenCalledTimes(1);

    // Segunda chamada: vem do cache
    const second = await getAggregatedDashboardMetrics(mockLojaID);
    expect(prisma.loja.findUnique).toHaveBeenCalledTimes(1);
    expect(second.generatedAt).toBe(first.generatedAt);
    expect(readLoyaltyReport).toHaveBeenCalledExactlyOnceWith(mockLojaID);

    // Outra loja consulta o próprio relatório, sem reutilizar o resultado em cache.
    await getAggregatedDashboardMetrics('tenant-other');
    expect(readLoyaltyReport).toHaveBeenLastCalledWith('tenant-other');
    expect(readLoyaltyReport).toHaveBeenCalledTimes(2);

    // Invalidação de cache
    invalidateDashboardCache(mockLojaID);

    // Terceira chamada: consulta banco novamente
    await getAggregatedDashboardMetrics(mockLojaID);
    expect(prisma.loja.findUnique).toHaveBeenCalledTimes(3);
    expect(readLoyaltyReport).toHaveBeenCalledTimes(3);
    expect(readLoyaltyReport).toHaveBeenLastCalledWith(mockLojaID);
    await getAggregatedDashboardMetrics('tenant-other');
    expect(readLoyaltyReport).toHaveBeenCalledTimes(3);
  });
});
