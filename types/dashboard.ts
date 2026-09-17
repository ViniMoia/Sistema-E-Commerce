import { OrderStatus, DeliveryType } from '@prisma/client';
import { z } from 'zod';

/**
 * ============================================================================
 * CONTINENTAL ADMIN DASHBOARD — CONTRATOS & DTOs DE DADOS SEGREGADOS (SOLID)
 * ============================================================================
 * Módulo de tipos segregados (Interface Segregation Principle - ISP)
 * Responsável por desacoplar os componentes de UI da estrutura interna do Prisma.
 *
 * NOTA DE SEGURANÇA & ESCOPO:
 * A gestão de Produtos (/admin/products) e Usuários (/admin/users) permanece 
 * estritamente isolada e não é modificada por este módulo.
 * ============================================================================
 */

// ─── 1. Inbox de Ações Imediatas (Action Inbox DTO) ─────────────────────────

export type UrgentActionReason = 'AWAITING_DISPATCH' | 'AWAITING_PICKUP' | 'PENDING_PIX';

export interface UrgentActionItemDTO {
  orderId: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string;
  total: number;
  createdAt: string;
  reason: UrgentActionReason;
  deliveryType: DeliveryType;
  shippingServiceName: string | null;
}

export interface DashboardActionInboxDTO {
  /** Pedidos pagos que aguardam envio e inserção de código de rastreamento */
  ordersAwaitingDispatchCount: number;
  /** Pedidos pagos para retirada física na loja */
  ordersAwaitingPickupCount: number;
  /** Pedidos pendentes aguardando pagamento PIX nas últimas 24h */
  ordersPendingPixCount: number;
  /** Lista prioritária de pedidos que demandam ação urgente do lojista */
  urgentItems: UrgentActionItemDTO[];
}

// ─── 2. Métricas Financeiras & PIX (Financial DTO) ──────────────────────────

export interface DashboardPixConfigDTO {
  hasPixKey: boolean;
  pixKeyType: string | null;
  pixKeyMasked: string | null;
  whatsappConfigured: boolean;
  whatsappNumber: string | null;
}

export interface DashboardFinancialDTO {
  /** Receita confirmada em pedidos pagos ou entregues (R$) */
  settledRevenue: number;
  /** Receita em aberto aguardando pagamento PIX (R$) */
  pendingRevenue: number;
  /** Volume financeiro de pedidos cancelados (R$) */
  cancelledRevenue: number;
  /** Ticket médio baseado exclusivamente em pedidos pagos (R$) */
  averageTicket: number;
  /** Total absoluto de pedidos computados */
  totalOrdersCount: number;
  /** Pedidos com status PAID */
  paidOrdersCount: number;
  /** Pedidos com status PENDING */
  pendingOrdersCount: number;
  /** Pedidos com status CANCELLED */
  cancelledOrdersCount: number;
  /** Taxa de conversão de pagamentos (Pagos / Total em %) */
  paymentConversionRatePct: number;
  /** Informações de status e configuração do gateway PIX */
  pixConfig: DashboardPixConfigDTO;
}

// ─── 3. Logística, Expedição & Frete Multi-Provedor (Logistics DTO) ──────────

export interface DashboardLogisticsCarriersBreakdownDTO {
  correiosCount: number;
  jtExpressCount: number;
  localTableCount: number;
  pickupCount: number;
  noneCount: number;
}

export interface DashboardLogisticsProviderStatusDTO {
  enableCorreios: boolean;
  hasJtExpressMatrix: boolean;
  localTableRulesCount: number;
  enablePickup: boolean;
  enableNoFreight: boolean;
  originCep: string | null;
}

export interface DashboardLogisticsDTO {
  /** Total arrecadado em taxas de envio/frete pagas pelos clientes (R$) */
  totalShippingRevenue: number;
  /** Pedidos com modalidade de entrega em domicílio (DELIVERY) */
  deliveryOrdersCount: number;
  /** Pedidos com retirada presencial no balcão da loja (PICKUP) */
  pickupOrdersCount: number;
  /** Pedidos com frete a combinar via WhatsApp (NONE) */
  customFreightOrdersCount: number;
  /** Pedidos pagos que ainda não foram despachados (sem trackingCode) */
  dispatchPendingCount: number;
  /** Pedidos já enviados / com trackingCode preenchido */
  dispatchedCount: number;
  /** Pedidos com status DELIVERED */
  deliveredCount: number;
  /** Distribuição de pedidos por provedor de envio */
  carriersBreakdown: DashboardLogisticsCarriersBreakdownDTO;
  /** Status de operabilidade dos provedores configurados */
  providerStatus: DashboardLogisticsProviderStatusDTO;
}

// ─── 4. Motor de Fidelidade & Pontos (Loyalty DTO) ──────────────────────────

export interface DashboardLoyaltySettingsDTO {
  loyaltyEarnRate: number;
  loyaltyPointValue: number;
  loyaltyMinPointsRedeem: number;
  loyaltyMaxDiscountPct: number;
  loyaltyPointsExpiryDays: number | null;
}

export interface DashboardLoyaltyTransactionDTO {
  id: string;
  userName: string;
  userEmail: string;
  type: string;
  points: number;
  balanceAfter: number;
  monetaryValue: number | null;
  description: string;
  orderId: string | null;
  createdAt: string;
}

export interface DashboardLoyaltyDTO {
  /** Flag master do programa de pontos da loja */
  loyaltyEnabled: boolean;
  /** Total de pontos ativos atualmente em poder dos clientes */
  totalCirculatingPoints: number;
  /** Passivo financeiro projetado em R$ caso todos os pontos fossem resgatados */
  projectedFinancialLiability: number;
  /** Total de pontos acumulados historicamente por compras */
  totalLifetimeEarnedPoints: number;
  /** Total de pontos já resgatados como desconto em pedidos */
  totalRedeemedPoints: number;
  /** Economia monetária total gerada aos clientes (R$) */
  totalRedeemedMonetaryDiscount: number;
  /** Número de clientes com carteira e saldo positivo no programa */
  activeWalletsCount: number;
  /** Configurações ativas de conversão e regras */
  settings: DashboardLoyaltySettingsDTO;
  /** Últimas transações de pontos para auditoria rápida no painel */
  recentTransactions: DashboardLoyaltyTransactionDTO[];
}

// ─── 5. Catálogo & Usuários (Contadores Informativos Intocados) ─────────────

export interface CatalogAndUserSummaryDTO {
  /** Total de produtos ativos cadastrados no catálogo (não alterado) */
  totalProducts: number;
  /** Total de clientes cadastrados na plataforma (não alterado) */
  totalCustomers: number;
}

// ─── 6. Pedido Recente Enriquecido (Recent Order DTO) ───────────────────────

export interface RecentOrderDashboardDTO {
  id: string;
  orderNumber: number;
  createdAt: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  status: OrderStatus;
  deliveryType: DeliveryType;
  shippingProvider: string | null;
  shippingServiceName: string | null;
  trackingCode: string | null;
  isAwaitingDispatch: boolean;
  customer: {
    id: string | null;
    name: string;
    email: string;
    phone: string | null;
  };
  pointsEarned: number;
  pointsRedeemed: number;
  pointsDiscountValue: number;
}

// ─── 7. Payload Agregado Consolidado do Dashboard ───────────────────────────

export interface AggregatedDashboardDataDTO {
  lojaID: string;
  lojaName: string;
  financial: DashboardFinancialDTO;
  logistics: DashboardLogisticsDTO;
  loyalty: DashboardLoyaltyDTO;
  inbox: DashboardActionInboxDTO;
  catalog: CatalogAndUserSummaryDTO;
  recentOrders: RecentOrderDashboardDTO[];
  generatedAt: string;
}

// ─── 8. Schemas Zod para Validação de Ações Rápidas (Segurança & RBAC) ──────

export const QuickUpdateLoyaltyConfigSchema = z.object({
  loyaltyEnabled: z.boolean(),
  loyaltyEarnRate: z.number().min(0.01).max(10),
  loyaltyPointValue: z.number().min(0.001).max(1),
  loyaltyMinPointsRedeem: z.number().int().min(1).default(100),
  loyaltyMaxDiscountPct: z.number().min(1).max(100).default(50),
});

export type QuickUpdateLoyaltyConfigInput = z.infer<typeof QuickUpdateLoyaltyConfigSchema>;

export const QuickManualPointsAdjustmentSchema = z.object({
  userID: z.string().uuid('ID de usuário inválido'),
  points: z.number().int().refine((val) => val !== 0, {
    message: 'A quantidade de pontos não pode ser zero',
  }),
  description: z.string().min(3, 'A justificativa do ajuste é obrigatória').max(255),
});

export type QuickManualPointsAdjustmentInput = z.infer<typeof QuickManualPointsAdjustmentSchema>;
