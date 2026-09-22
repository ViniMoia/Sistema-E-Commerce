import { LoyaltyTxType } from '@prisma/client'

export interface LoyaltySettings {
  loyaltyEnabled: boolean
  loyaltyEarnRate: number // ex: 0.5 (1 pt a cada R$ 2,00)
  loyaltyPointValue: number // ex: 0.05 (R$ 0,05 por ponto)
  loyaltyMinPointsRedeem: number // ex: 100
  loyaltyMaxDiscountPct: number // ex: 50.0 (%)
  loyaltyPointsExpiryDays: number | null // ex: 365 dias
}

export interface LoyaltyWalletSummary {
  walletId: string
  lojaID: string
  userID: string
  balance: number
  pending: number
  lifetimeEarn: number
  monetaryBalance: number // Saldo convertido em R$
  settings: LoyaltySettings
}

export interface SimulateRedeemInput {
  lojaID: string
  userID?: string
  subtotal: number
  requestedPoints: number
}

export interface SimulateRedeemResult {
  eligible: boolean
  pointsToRedeem: number
  discountValue: number
  subtotalAfterDiscount: number
  projectedEarnedPoints: number
  reason?: string
  walletBalance?: number
}

export interface CreditEarnedPointsParams {
  lojaID: string
  userID: string
  orderId: string
  subtotal: number
  description?: string
}

export interface DebitRedeemedPointsParams {
  lojaID: string
  userID: string
  orderId: string
  points: number
  monetaryValue: number
  description?: string
}

export interface RefundOrderPointsParams {
  lojaID: string
  orderId: string
  reason?: string
}

export interface ManualAdjustmentParams {
  lojaID: string
  userID: string
  points: number // Positivo para crédito, negativo para débito
  description: string
  adminUserId: string
}

export interface LoyaltyStatementParams {
  lojaID: string
  userID: string
  page?: number
  limit?: number
}

export interface LoyaltyStatementItem {
  id: string
  type: LoyaltyTxType
  points: number
  balanceAfter: number
  monetaryValue: number | null
  description: string
  orderId: string | null
  createdAt: Date
  expiresAt: Date | null
}

export interface LoyaltyStatementResult {
  items: LoyaltyStatementItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  wallet: {
    balance: number
    pending: number
    lifetimeEarn: number
    monetaryBalance: number
  }
}

export interface ExpireLoyaltyPointsParams {
  lojaID: string
  userID: string
  points: number
  description?: string
}

export interface ProcessLoyaltyExpirationsOptions {
  lojaID?: string
  now?: Date
}

export interface ProcessLoyaltyExpirationsResult {
  processedWallets: number
  expiredCount: number
  totalPointsExpired: number
  errors: Array<{ userId: string; lojaId: string; error: string }>
}

