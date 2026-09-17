import prisma from '@/lib/prisma';
import { tenantCache } from '@/lib/cache';
import { Prisma, OrderStatus, DeliveryType } from '@prisma/client';
import type {
  AggregatedDashboardDataDTO,
  DashboardActionInboxDTO,
  DashboardFinancialDTO,
  DashboardLogisticsDTO,
  DashboardLoyaltyDTO,
  RecentOrderDashboardDTO,
  UrgentActionItemDTO,
} from '@/types/dashboard';

/**
 * ============================================================================
 * CONTINENTAL ADMIN DASHBOARD — SERVIÇO DE AGREGAÇÃO DE DADOS (SOLID)
 * ============================================================================
 * Responsável exclusivo pela agregação atômica e cache multi-tenant de todas
 * as métricas do painel administrativo.
 *
 * Princípios Arquiteturais:
 * - Single Responsibility (SRP): Apenas agrega e formata dados de dashboard.
 * - Dependency Inversion (DIP): Retorna DTOs puros e desacoplados do Prisma.
 * - Multi-Tenancy (SEC): Todas as queries usam filtro estrito por lojaID.
 * ============================================================================
 */

function maskPixKey(key: string | null | undefined, type: string | null | undefined): string | null {
  if (!key) return null;
  const clean = key.trim();
  if (clean.length <= 4) return '****';

  if (type === 'CPF' || /^\d{11}$/.test(clean.replace(/\D/g, ''))) {
    const digits = clean.replace(/\D/g, '');
    return `***.***.${digits.slice(6, 9)}-**`;
  }

  if (type === 'CNPJ' || /^\d{14}$/.test(clean.replace(/\D/g, ''))) {
    const digits = clean.replace(/\D/g, '');
    return `**.***.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
  }

  if (type === 'EMAIL' || clean.includes('@')) {
    const [user, domain] = clean.split('@');
    if (!domain) return clean;
    const maskedUser = user.length > 2 ? `${user.slice(0, 2)}***` : `${user}***`;
    return `${maskedUser}@${domain}`;
  }

  if (type === 'TELEFONE' || /^\d{10,11}$/.test(clean.replace(/\D/g, ''))) {
    const digits = clean.replace(/\D/g, '');
    return `(${digits.slice(0, 2)}) 9****-${digits.slice(-4)}`;
  }

  // Chave aleatória / Evp
  return `****-****-${clean.slice(-4)}`;
}

export async function getAggregatedDashboardMetrics(
  lojaID: string
): Promise<AggregatedDashboardDataDTO> {
  if (!lojaID || typeof lojaID !== 'string') {
    throw new Error('[DASHBOARD_SERVICE] lojaID é obrigatório para consultar métricas.');
  }

  // Cache memoizado por tenant (TTL 60 segundos)
  return await tenantCache.getOrSet(
    lojaID,
    'dashboard',
    'aggregated_metrics_v1',
    async () => {
      // 1. Execução paralela em batch das consultas necessárias
      const [
        loja,
        orderGroups,
        carrierGroups,
        awaitingDispatchCount,
        awaitingPickupCount,
        pendingPixCount,
        urgentOrdersRaw,
        recentOrdersRaw,
        totalProducts,
        totalCustomers,
        localTableRulesCount,
        jtExpressRatesCount,
        walletsAggregate,
        activeWalletsCount,
        redeemAggregate,
        recentLoyaltyTxRaw,
      ] = await Promise.all([
        // Configurações da Loja
        prisma.loja.findUnique({
          where: { id: lojaID },
          select: {
            id: true,
            name: true,
            originCep: true,
            enableCorreios: true,
            enablePickup: true,
            enableNoFreight: true,
            pixKey: true,
            pixKeyType: true,
            whatsappNumber: true,
            loyaltyEnabled: true,
            loyaltyEarnRate: true,
            loyaltyPointValue: true,
            loyaltyMinPointsRedeem: true,
            loyaltyMaxDiscountPct: true,
            loyaltyPointsExpiryDays: true,
          },
        }),

        // Agrupamento de pedidos por status (Financeiro & Funil)
        prisma.order.groupBy({
          by: ['status'],
          where: { lojaID },
          _count: { _all: true },
          _sum: { total: true, shippingCost: true },
        }),

        // Agrupamento de pedidos por Provedor e Tipo de Entrega (Logística)
        prisma.order.groupBy({
          by: ['deliveryType', 'shippingProvider'],
          where: { lojaID },
          _count: { _all: true },
          _sum: { shippingCost: true },
        }),

        // Inbox Operacional: Pedidos pagos que precisam de despacho
        prisma.order.count({
          where: {
            lojaID,
            status: { in: [OrderStatus.PAID] },
            deliveryType: DeliveryType.DELIVERY,
            trackingCode: null,
          },
        }),

        // Inbox Operacional: Pedidos pagos para retirada no balcão
        prisma.order.count({
          where: {
            lojaID,
            status: { in: [OrderStatus.PAID] },
            deliveryType: DeliveryType.PICKUP,
          },
        }),

        // Inbox Operacional: Pedidos pendentes de pagamento PIX
        prisma.order.count({
          where: {
            lojaID,
            status: OrderStatus.PENDING,
          },
        }),

        // Pedidos Urgentes para exibição no Inbox
        prisma.order.findMany({
          where: {
            lojaID,
            OR: [
              {
                status: OrderStatus.PAID,
                deliveryType: DeliveryType.DELIVERY,
                trackingCode: null,
              },
              {
                status: OrderStatus.PAID,
                deliveryType: DeliveryType.PICKUP,
              },
              {
                status: OrderStatus.PENDING,
              },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        }),

        // 10 Pedidos Recentes com metadados completos
        prisma.order.findMany({
          where: { lojaID },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        }),

        // Contadores estáticos de catálogo e clientes (INALTERADOS)
        prisma.product.count({ where: { lojaID } }),
        prisma.user.count({ where: { lojaID, role: 'CUSTOMER' } }),

        // Status dos Provedores Locais
        prisma.freightRule.count({ where: { lojaID } }),
        prisma.jtExpressRate.count(),

        // Agregação de Carteiras de Fidelidade
        prisma.loyaltyWallet.aggregate({
          where: { lojaID },
          _sum: {
            balance: true,
            lifetimeEarn: true,
          },
        }),

        // Carteiras com saldo positivo
        prisma.loyaltyWallet.count({
          where: {
            lojaID,
            balance: { gt: 0 },
          },
        }),

        // Agregação de Resgates de Fidelidade
        prisma.loyaltyTransaction.aggregate({
          where: {
            lojaID,
            type: 'REDEEM',
          },
          _sum: {
            points: true,
            monetaryValue: true,
          },
        }),

        // Transações Recentes de Fidelidade para auditoria no widget
        prisma.loyaltyTransaction.findMany({
          where: { lojaID },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        }),
      ]);

      if (!loja) {
        throw new Error(`[DASHBOARD_SERVICE] Loja não encontrada para ID: ${lojaID}`);
      }

      // ─── 2. Consolidação de Métricas Financeiras & Funil ───────────────────
      let settledRevenue = 0;
      let pendingRevenue = 0;
      let cancelledRevenue = 0;
      let totalOrdersCount = 0;
      let paidOrdersCount = 0;
      let pendingOrdersCount = 0;
      let cancelledOrdersCount = 0;
      let settledOrdersCount = 0; // Pagos + Enviados + Entregues

      for (const group of orderGroups) {
        const count = group._count._all;
        const totalVal = group._sum.total?.toNumber() ?? 0;
        totalOrdersCount += count;

        switch (group.status) {
          case OrderStatus.PAID:
            paidOrdersCount += count;
            settledOrdersCount += count;
            settledRevenue += totalVal;
            break;
          case OrderStatus.SHIPPED:
          case OrderStatus.DELIVERED:
            settledOrdersCount += count;
            settledRevenue += totalVal;
            break;
          case OrderStatus.PENDING:
            pendingOrdersCount += count;
            pendingRevenue += totalVal;
            break;
          case OrderStatus.CANCELLED:
            cancelledOrdersCount += count;
            cancelledRevenue += totalVal;
            break;
        }
      }

      const averageTicket =
        settledOrdersCount > 0 ? settledRevenue / settledOrdersCount : 0;
      const paymentConversionRatePct =
        totalOrdersCount > 0
          ? Math.round((settledOrdersCount / totalOrdersCount) * 100)
          : 0;

      const financialDTO: DashboardFinancialDTO = {
        settledRevenue: Math.round(settledRevenue * 100) / 100,
        pendingRevenue: Math.round(pendingRevenue * 100) / 100,
        cancelledRevenue: Math.round(cancelledRevenue * 100) / 100,
        averageTicket: Math.round(averageTicket * 100) / 100,
        totalOrdersCount,
        paidOrdersCount,
        pendingOrdersCount,
        cancelledOrdersCount,
        paymentConversionRatePct,
        pixConfig: {
          hasPixKey: Boolean(loja.pixKey),
          pixKeyType: loja.pixKeyType,
          pixKeyMasked: maskPixKey(loja.pixKey, loja.pixKeyType),
          whatsappConfigured: Boolean(loja.whatsappNumber),
          whatsappNumber: loja.whatsappNumber,
        },
      };

      // ─── 3. Consolidação de Métricas de Logística & Frete ───────────────────
      let totalShippingRevenue = 0;
      let deliveryOrdersCount = 0;
      let pickupOrdersCount = 0;
      let customFreightOrdersCount = 0;

      const carriersBreakdown = {
        correiosCount: 0,
        jtExpressCount: 0,
        localTableCount: 0,
        pickupCount: 0,
        noneCount: 0,
      };

      for (const group of carrierGroups) {
        const count = group._count._all;
        const shippingVal = group._sum.shippingCost?.toNumber() ?? 0;
        totalShippingRevenue += shippingVal;

        if (group.deliveryType === DeliveryType.DELIVERY) {
          deliveryOrdersCount += count;
        } else if (group.deliveryType === DeliveryType.PICKUP) {
          pickupOrdersCount += count;
          carriersBreakdown.pickupCount += count;
        } else if (group.deliveryType === DeliveryType.NONE) {
          customFreightOrdersCount += count;
          carriersBreakdown.noneCount += count;
        }

        const provider = group.shippingProvider?.toUpperCase() || '';
        if (provider.includes('CORREIOS')) {
          carriersBreakdown.correiosCount += count;
        } else if (provider.includes('JT') || provider.includes('J&T')) {
          carriersBreakdown.jtExpressCount += count;
        } else if (provider.includes('LOCAL')) {
          carriersBreakdown.localTableCount += count;
        }
      }

      const logisticsDTO: DashboardLogisticsDTO = {
        totalShippingRevenue: Math.round(totalShippingRevenue * 100) / 100,
        deliveryOrdersCount,
        pickupOrdersCount,
        customFreightOrdersCount,
        dispatchPendingCount: awaitingDispatchCount,
        dispatchedCount: orderGroups.find((g) => g.status === OrderStatus.SHIPPED)?._count._all ?? 0,
        deliveredCount: orderGroups.find((g) => g.status === OrderStatus.DELIVERED)?._count._all ?? 0,
        carriersBreakdown,
        providerStatus: {
          enableCorreios: loja.enableCorreios,
          hasJtExpressMatrix: jtExpressRatesCount > 0,
          localTableRulesCount,
          enablePickup: loja.enablePickup,
          enableNoFreight: loja.enableNoFreight,
          originCep: loja.originCep,
        },
      };

      // ─── 4. Consolidação de Métricas de Fidelidade & Pontos ─────────────────
      const pointValue = (loja.loyaltyPointValue as Prisma.Decimal | null)?.toNumber() ?? 0.05;
      const totalCirculatingPoints = walletsAggregate._sum.balance ?? 0;
      const projectedFinancialLiability = Math.round(totalCirculatingPoints * pointValue * 100) / 100;
      const totalLifetimeEarnedPoints = walletsAggregate._sum.lifetimeEarn ?? 0;
      const totalRedeemedPoints = Math.abs(redeemAggregate._sum.points ?? 0);
      const totalRedeemedMonetaryDiscount =
        redeemAggregate._sum.monetaryValue?.toNumber() ?? 0;

      const loyaltyDTO: DashboardLoyaltyDTO = {
        loyaltyEnabled: loja.loyaltyEnabled,
        totalCirculatingPoints,
        projectedFinancialLiability,
        totalLifetimeEarnedPoints,
        totalRedeemedPoints,
        totalRedeemedMonetaryDiscount: Math.round(totalRedeemedMonetaryDiscount * 100) / 100,
        activeWalletsCount,
        settings: {
          loyaltyEarnRate: (loja.loyaltyEarnRate as Prisma.Decimal | null)?.toNumber() ?? 0.5,
          loyaltyPointValue: pointValue,
          loyaltyMinPointsRedeem: loja.loyaltyMinPointsRedeem ?? 100,
          loyaltyMaxDiscountPct: (loja.loyaltyMaxDiscountPct as Prisma.Decimal | null)?.toNumber() ?? 50,
          loyaltyPointsExpiryDays: loja.loyaltyPointsExpiryDays ?? 365,
        },
        recentTransactions: recentLoyaltyTxRaw.map((tx) => ({
          id: tx.id,
          userName: tx.user?.name || 'Cliente',
          userEmail: tx.user?.email || '',
          type: tx.type,
          points: tx.points,
          balanceAfter: tx.balanceAfter,
          monetaryValue: tx.monetaryValue ? (tx.monetaryValue as Prisma.Decimal).toNumber() : null,
          description: tx.description,
          orderId: tx.orderId,
          createdAt: tx.createdAt.toISOString(),
        })),
      };

      // ─── 5. Consolidação de Alertas do Inbox Operacional ────────────────────
      const urgentItems: UrgentActionItemDTO[] = urgentOrdersRaw.map((ord) => {
        let reason: UrgentActionItemDTO['reason'] = 'PENDING_PIX';
        if (ord.status === OrderStatus.PAID) {
          if (ord.deliveryType === DeliveryType.PICKUP) {
            reason = 'AWAITING_PICKUP';
          } else {
            reason = 'AWAITING_DISPATCH';
          }
        }

        return {
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          customerName: ord.user?.name || 'Cliente',
          customerEmail: ord.user?.email || '',
          customerPhone: ord.user?.phone || null,
          total: (ord.total as Prisma.Decimal).toNumber(),
          createdAt: ord.createdAt.toISOString(),
          reason,
          deliveryType: ord.deliveryType,
          shippingServiceName: ord.shippingServiceName,
        };
      });

      const inboxDTO: DashboardActionInboxDTO = {
        ordersAwaitingDispatchCount: awaitingDispatchCount,
        ordersAwaitingPickupCount: awaitingPickupCount,
        ordersPendingPixCount: pendingPixCount,
        urgentItems,
      };

      // ─── 6. Consolidação de Pedidos Recentes Enriquecidos ───────────────────
      const recentOrdersDTO: RecentOrderDashboardDTO[] = recentOrdersRaw.map((ord) => {
        const isAwaitingDispatch =
          ord.status === OrderStatus.PAID &&
          ord.deliveryType === DeliveryType.DELIVERY &&
          !ord.trackingCode;

        return {
          id: ord.id,
          orderNumber: ord.orderNumber,
          createdAt: ord.createdAt.toISOString(),
          total: (ord.total as Prisma.Decimal).toNumber(),
          subtotal: (ord.subtotal as Prisma.Decimal).toNumber(),
          shippingCost: (ord.shippingCost as Prisma.Decimal).toNumber(),
          status: ord.status,
          deliveryType: ord.deliveryType,
          shippingProvider: ord.shippingProvider,
          shippingServiceName: ord.shippingServiceName,
          trackingCode: ord.trackingCode,
          isAwaitingDispatch,
          customer: {
            id: ord.user?.id ?? null,
            name: ord.user?.name || 'Cliente',
            email: ord.user?.email || '',
            phone: ord.user?.phone || null,
          },
          pointsEarned: ord.pointsEarned ?? 0,
          pointsRedeemed: ord.pointsRedeemed ?? 0,
          pointsDiscountValue: ord.pointsDiscountValue
            ? (ord.pointsDiscountValue as Prisma.Decimal).toNumber()
            : 0,
        };
      });

      // ─── 7. Payload Final do Dashboard ─────────────────────────────────────
      const aggregated: AggregatedDashboardDataDTO = {
        lojaID: loja.id,
        lojaName: loja.name,
        financial: financialDTO,
        logistics: logisticsDTO,
        loyalty: loyaltyDTO,
        inbox: inboxDTO,
        catalog: {
          totalProducts,
          totalCustomers,
        },
        recentOrders: recentOrdersDTO,
        generatedAt: new Date().toISOString(),
      };

      return aggregated;
    },
    60000 // 60 segundos de cache
  );
}

/**
 * Invalida o cache do dashboard para uma loja específica
 * (chamado quando novos pedidos são criados, atualizados ou quando o frete/pontos mudam).
 */
export function invalidateDashboardCache(lojaID: string): void {
  if (!lojaID) return;
  tenantCache.del(lojaID, 'dashboard', 'aggregated_metrics_v1');
}
