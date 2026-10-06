import { exactEarnPoints, earnSnapshotSchema } from '@/lib/commerce/loyalty-earn'
import prisma from '@/lib/prisma'
import { Prisma, LoyaltyTxType } from '@prisma/client'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { CommerceLocks } from '@/lib/commerce/locks'
import { LoyaltyError, assertPoints, creditExpiry } from '@/lib/commerce/loyalty-policy'
import { lockLoyaltyWallet, creditLockedLoyalty, debitLockedLoyalty, expireLockedLoyalty, loyaltyEffect,
  reverseEarnLockedLoyalty, restoreRedeemLockedLoyalty, deferLegacyLoyalty, inspectLoyaltyAccounting } from '@/lib/commerce/loyalty-ledger'
export { LoyaltyError } from '@/lib/commerce/loyalty-policy'
import type {
  LoyaltySettings,
  LoyaltyWalletSummary,
  SimulateRedeemInput,
  SimulateRedeemResult,
  CreditEarnedPointsParams,
  DebitRedeemedPointsParams,
  RefundOrderPointsParams,
  ManualAdjustmentParams,
  LoyaltyStatementParams,
  LoyaltyStatementResult,
  ExpireLoyaltyPointsParams,
  ProcessLoyaltyExpirationsOptions,
  ProcessLoyaltyExpirationsResult,
} from '@/types/loyalty.types'

// ─── Custom Errors ────────────────────────────────────────────────


// ─── Zod Schemas ──────────────────────────────────────────────────

export const SimulateLoyaltyRedeemSchema = z.object({
  lojaID: z.string().min(1, 'lojaID é obrigatório'),
  userID: z.string().optional(),
  subtotal: z.number().positive('Subtotal deve ser maior que zero'),
  requestedPoints: z.number().int().min(0, 'Pontos solicitados não podem ser negativos'),
})

export const DEFAULT_MAX_MANUAL_ADJUSTMENT_POINTS = 100_000

function getMaxManualAdjustmentPoints(): number {
  const configured = Number(process.env.ADMIN_LOYALTY_MAX_ADJUSTMENT_POINTS)
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_MANUAL_ADJUSTMENT_POINTS
}

export const AdjustLoyaltyBalanceSchema = z.object({
  lojaID: z.string().min(1, 'lojaID é obrigatório'),
  userID: z.string().min(1, 'userID é obrigatório'),
  points: z.number().int().refine((val) => val !== 0, {
    message: 'A quantidade de pontos para ajuste não pode ser zero',
  }).refine((val) => Math.abs(val) <= getMaxManualAdjustmentPoints(), {
    message: 'A quantidade de pontos excede o limite permitido para um único ajuste',
  }),
  description: z.string().min(3, 'Descrição deve ter no mínimo 3 caracteres').max(255),
  adminUserId: z.string().min(1, 'adminUserId é obrigatório'),
  commandId: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/, 'Identidade do ajuste é obrigatória'),
  expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
}).strict()

export const UpdateLoyaltyConfigSchema = z.object({
  loyaltyEnabled: z.boolean(),
  loyaltyEarnRate: z.number().min(0, 'Taxa de acúmulo não pode ser negativa').max(100),
  loyaltyPointValue: z.number().min(0.0001, 'Valor do ponto deve ser positivo').max(100),
  loyaltyMinPointsRedeem: z.number().int().min(0, 'Mínimo de pontos não pode ser negativo'),
  loyaltyMaxDiscountPct: z.number().min(0).max(100, 'Percentual máximo de desconto deve estar entre 0 e 100'),
  loyaltyPointsExpiryDays: z.number().int().positive('Validade em dias deve ser positiva').nullable().optional(),
})

// ─── Funções Puras de Cálculo Matemático ──────────────────────────

/**
 * Calcula a quantidade de pontos que o cliente acumula com base no subtotal elegível.
 * Fórmula: Math.floor(subtotal * earnRate)
 */
export function calculatePointsEarned(subtotal: number | Prisma.Decimal, earnRate: number | Prisma.Decimal): number {
  if (Number(subtotal) <= 0 || Number(earnRate) <= 0 || !Number.isFinite(Number(subtotal)) || !Number.isFinite(Number(earnRate))) return 0
  return exactEarnPoints(subtotal, earnRate)
}

/**
 * Converte uma quantidade de pontos em valor monetário de desconto (R$).
 * Fórmula: Number((points * pointValue).toFixed(2))
 */
export function calculateDiscountFromPoints(points: number, pointValue: number | Prisma.Decimal): number {
  if (points <= 0) return 0
  const pointValueNum = typeof pointValue === 'number' ? pointValue : Number(pointValue.toString())
  if (isNaN(pointValueNum) || pointValueNum <= 0) return 0

  const discount = points * pointValueNum
  return Number(discount.toFixed(2))
}

/**
 * Calcula o teto máximo monetário de desconto permitido para um subtotal.
 */
export function calculateMaxAllowedDiscount(subtotal: number, maxDiscountPct: number): number {
  if (subtotal <= 0 || maxDiscountPct <= 0) return 0
  const maxPct = Math.min(100, maxDiscountPct)
  const maxDiscount = subtotal * (maxPct / 100)
  return Number(maxDiscount.toFixed(2))
}

// ─── Leitura e Gestão de Configurações da Loja ────────────────────

/**
 * Obtém as configurações do programa de pontos de uma loja específica.
 */
export async function getLoyaltySettings(
  lojaID: string,
  tx?: Prisma.TransactionClient
): Promise<LoyaltySettings> {
  const client = tx || prisma
  const loja = await client.loja.findUnique({
    where: { id: lojaID },
    select: {
      loyaltyEnabled: true,
      loyaltyEarnRate: true,
      loyaltyPointValue: true,
      loyaltyMinPointsRedeem: true,
      loyaltyMaxDiscountPct: true,
      loyaltyPointsExpiryDays: true,
    },
  })

  if (!loja) {
    throw new LoyaltyError('LOJA_NOT_FOUND', `Loja ${lojaID} não encontrada.`)
  }

  return {
    loyaltyEnabled: loja.loyaltyEnabled,
    loyaltyEarnRate: Number(loja.loyaltyEarnRate.toString()),
    loyaltyPointValue: Number(loja.loyaltyPointValue.toString()),
    loyaltyMinPointsRedeem: loja.loyaltyMinPointsRedeem,
    loyaltyMaxDiscountPct: Number(loja.loyaltyMaxDiscountPct.toString()),
    loyaltyPointsExpiryDays: loja.loyaltyPointsExpiryDays,
  }
}

// ─── Gestão de Carteira (LoyaltyWallet) ───────────────────────────

/**
 * Obtém ou inicializa a carteira de fidelidade do usuário na loja.
 */
export async function getOrCreateWallet(lojaID: string, userID: string, tx?: Prisma.TransactionClient) {
  const run = async (client: Prisma.TransactionClient) => (await lockLoyaltyWallet(client, { lojaID, userID }, true))!.wallet
  return tx ? run(tx) : prisma.$transaction(run)
}

/**
 * Retorna o resumo consolidado da carteira do cliente, incluindo configurações e saldo em R$.
 */
export async function getWalletSummary(
  lojaID: string,
  userID: string
): Promise<LoyaltyWalletSummary> {
  const settings = await getLoyaltySettings(lojaID)
  await assertLoyaltyAccount(lojaID, userID)
  const wallet = await prisma.loyaltyWallet.findUnique({ where: { lojaID_userID: { lojaID, userID } } })
  const balance = Math.max(0, wallet?.balance ?? 0)

  const monetaryBalance = calculateDiscountFromPoints(balance, settings.loyaltyPointValue)

  return {
    walletId: wallet?.id ?? null,
    lojaID,
    userID,
    balance,
    debt: wallet?.debt ?? 0,
    accountingReady: wallet ? wallet.accountingReady : true,
    pending: wallet?.pending ?? 0,
    lifetimeEarn: wallet?.lifetimeEarn ?? 0,
    monetaryBalance,
    settings,
  }
}

async function assertLoyaltyAccount(lojaID: string, userID: string, client: Prisma.TransactionClient = prisma) {
  const user = await client.user.findUnique({
    where: { id_lojaID: { id: userID, lojaID } }, select: { id: true, status: true },
  })
  if (!user || user.status !== 'ACTIVE') throw new LoyaltyError('USER_NOT_FOUND', 'Conta não encontrada ou indisponível nesta loja.')
}

// ─── Simulação de Resgate para Checkout ───────────────────────────

/**
 * Simula de forma autoritativa a aplicação de pontos como desconto no checkout.
 */
export async function simulatePointsRedemption(
  input: SimulateRedeemInput, tx?: Prisma.TransactionClient
): Promise<SimulateRedeemResult> {
  const validated = SimulateLoyaltyRedeemSchema.parse(input)
  const settings = await getLoyaltySettings(validated.lojaID, tx)

  if (!validated.userID) {
    return { eligible: false, pointsToRedeem: 0, discountValue: 0,
      subtotalAfterDiscount: validated.subtotal, projectedEarnedPoints: settings.loyaltyEnabled
        ? calculatePointsEarned(validated.subtotal, settings.loyaltyEarnRate) : 0,
      reason: 'Entre na sua conta para utilizar o programa de pontos.' }
  }
  // The service also validates tenant ownership for internal/alternate callers.
  await assertLoyaltyAccount(validated.lojaID, validated.userID, tx ?? prisma)

  // 1. Projeção de pontos ganhos nesta compra
  const projectedEarnedPoints = settings.loyaltyEnabled
    ? calculatePointsEarned(validated.subtotal, settings.loyaltyEarnRate)
    : 0

  // 2. Se o programa estiver desabilitado
  if (!settings.loyaltyEnabled) {
    return {
      eligible: false,
      pointsToRedeem: 0,
      discountValue: 0,
      subtotalAfterDiscount: validated.subtotal,
      projectedEarnedPoints: 0,
      reason: 'Programa de pontos desativado nesta loja.',
    }
  }

  // 3. Se não houver solicitação de resgate
  if (validated.requestedPoints <= 0) {
    return {
      eligible: true,
      pointsToRedeem: 0,
      discountValue: 0,
      subtotalAfterDiscount: validated.subtotal,
      projectedEarnedPoints,
    }
  }

  // 4. Se houver userID, carregar saldo real da carteira
  const wallet = await (tx ?? prisma).loyaltyWallet.findUnique({
    where: { lojaID_userID: { lojaID: validated.lojaID, userID: validated.userID } },
  })
  if (wallet && !wallet.accountingReady) return { eligible: false, pointsToRedeem: 0, discountValue: 0,
    subtotalAfterDiscount: validated.subtotal, projectedEarnedPoints, walletBalance: Math.max(0, wallet.balance),
    reason: 'Carteira aguardando conciliação de origem dos créditos.' }
  const due = wallet ? await (tx ?? prisma).loyaltyLot.aggregate({ where: { walletId: wallet.id, expiresAt: { lte: new Date() } }, _sum: { remaining: true } }) : null
  const availableBalance = Math.max(0, (wallet?.balance ?? 0) - (due?._sum.remaining ?? 0))

  // 5. Validação de saldo mínimo para resgate
  if (availableBalance < settings.loyaltyMinPointsRedeem) {
    return {
      eligible: false,
      pointsToRedeem: 0,
      discountValue: 0,
      subtotalAfterDiscount: validated.subtotal,
      projectedEarnedPoints,
      walletBalance: availableBalance,
      reason: `Saldo mínimo para resgate é de ${settings.loyaltyMinPointsRedeem} pontos.`,
    }
  }

  // 6. Determinar quantidade efetiva de pontos a usar (limitada ao saldo)
  const pointsToUse = Math.min(validated.requestedPoints, availableBalance)

  if (pointsToUse < settings.loyaltyMinPointsRedeem) {
    return {
      eligible: false,
      pointsToRedeem: 0,
      discountValue: 0,
      subtotalAfterDiscount: validated.subtotal,
      projectedEarnedPoints,
      walletBalance: availableBalance,
      reason: `Quantidade solicitada está abaixo do resgate mínimo (${settings.loyaltyMinPointsRedeem} pts).`,
    }
  }

  // 7. Calcular desconto nominal
  let discountValue = calculateDiscountFromPoints(pointsToUse, settings.loyaltyPointValue)

  // 8. Aplicar teto percentual máximo permitido no subtotal
  const maxAllowedDiscount = calculateMaxAllowedDiscount(validated.subtotal, settings.loyaltyMaxDiscountPct)

  // Se o desconto ultrapassar o teto ou o próprio subtotal, recalcula os pontos necessários
  if (discountValue > maxAllowedDiscount) {
    discountValue = maxAllowedDiscount
  }
  if (discountValue > validated.subtotal) {
    discountValue = validated.subtotal
  }

  // Recalcula os pontos exatos consumidos para cobrir esse desconto efetivo
  const effectivePoints = Math.ceil(discountValue / settings.loyaltyPointValue)
  const finalPoints = Math.min(pointsToUse, effectivePoints)
  const finalDiscount = calculateDiscountFromPoints(finalPoints, settings.loyaltyPointValue)
  const subtotalAfterDiscount = Number(Math.max(0, validated.subtotal - finalDiscount).toFixed(2))

  // Recalcula pontos a ganhar com base no novo subtotal após o desconto
  const finalProjectedEarned = calculatePointsEarned(subtotalAfterDiscount, settings.loyaltyEarnRate)

  return {
    eligible: true,
    pointsToRedeem: finalPoints,
    discountValue: finalDiscount,
    subtotalAfterDiscount,
    projectedEarnedPoints: finalProjectedEarned,
    walletBalance: availableBalance,
  }
}

// ─── Operações Transacionais Contábeis (Ledger Engine) ────────────

async function inOrderTransaction<T>(orderId: string, tx: Prisma.TransactionClient | undefined, run: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (tx) return run(tx) // Trusted caller owns the order or just inserted it.
  return prisma.$transaction(async client => {
    await new CommerceLocks(client).acquire('order', [orderId])
    return run(client)
  })
}
async function scopedOrder(client: Prisma.TransactionClient, lojaID: string, orderId: string, userID?: string) {
  const order = await client.order.findUnique({ where: { id: orderId }, include: { loyaltyTransactions: true } })
  if (!order || order.lojaID !== lojaID || (userID && order.userID !== userID)) throw new LoyaltyError('ORDER_NOT_FOUND', 'Pedido não encontrado para esta conta/loja.')
  return order
}
export async function creditEarnedPoints(params: CreditEarnedPointsParams, tx?: Prisma.TransactionClient) {
  if (!Number.isFinite(params.subtotal) || params.subtotal < 0) throw new LoyaltyError('INVALID_INPUT', 'Subtotal inválido.')
  return inOrderTransaction(params.orderId, tx, async client => {
    const order = await scopedOrder(client, params.lojaID, params.orderId, params.userID)
    if (order.status !== 'PAID') throw new LoyaltyError('INVALID_STATE', 'Ganho exige pedido pago.')
    const identity = loyaltyEffect('earn', params, params.orderId, [params.subtotal, params.description ?? null])
    const previous = order.loyaltyTransactions.find(t => t.effectKey === identity.key)
    if (!order.loyaltyEarnSnapshot) {
      await deferLegacyLoyalty(client, 'EARN', params, { reason: 'LEGACY_EARN_POLICY_UNKNOWN', subtotal: params.subtotal });
      return null;
    }
    const snapshot = earnSnapshotSchema.parse(order.loyaltyEarnSnapshot);
    if (snapshot.points !== exactEarnPoints(snapshot.base, snapshot.rate) && snapshot.enabled && snapshot.eligible) throw new LoyaltyError('INVALID_POLICY', 'Snapshot de ganho inconsistente.');
    const settings = { loyaltyEnabled: snapshot.enabled && snapshot.eligible, loyaltyEarnRate: Number(snapshot.rate),
      loyaltyPointValue: Number(snapshot.pointValue), loyaltyPointsExpiryDays: snapshot.expiryDays };
    const points = previous?.points ?? snapshot.points; assertPoints(points);
    const state = await lockLoyaltyWallet(client, params, true)
    if (!state) throw new LoyaltyError('WALLET_NOT_FOUND', 'Carteira não encontrada.')
    if (!state.wallet.accountingReady || order.loyaltyTransactions.some(t => t.type === 'EARN' && t.availableDelta === null)) {
      await deferLegacyLoyalty(client, 'EARN', params, { subtotal: params.subtotal, settings: { ...settings }, reason: 'LEGACY_ORIGIN_UNKNOWN' })
      return null
    }
    if (!previous && (!settings.loyaltyEnabled || !points)) return null
    const expiresAt = previous ? previous.expiresAt : creditExpiry(settings.loyaltyPointsExpiryDays, state.now)
    const result = await creditLockedLoyalty(state, { ...identity,
      type: 'EARN', points, orderId: params.orderId, description: params.description ?? 'Pontos ganhos no pedido',
      monetaryValue: new Prisma.Decimal(calculateDiscountFromPoints(points, settings.loyaltyPointValue)), expiry: expiresAt,
      policy: { ...snapshot } }, [{ points, expiry: expiresAt }], points)
    await client.order.update({ where: { id: order.id }, data: { pointsCredited: result.transaction.points } })
    return { pointsCredited: result.transaction.points, newBalance: result.wallet.balance, transaction: result.transaction, replay: result.replay }
  })
}
export async function debitRedeemedPoints(params: DebitRedeemedPointsParams, tx?: Prisma.TransactionClient) {
  assertPoints(params.points)
  if (!Number.isFinite(params.monetaryValue) || params.monetaryValue < 0) throw new LoyaltyError('INVALID_INPUT', 'Valor do resgate inválido.')
  if (!params.points) return null
  return inOrderTransaction(params.orderId, tx, async client => {
    const order = await scopedOrder(client, params.lojaID, params.orderId, params.userID)
    if (!order.loyaltyTransactions.some(t => t.type === 'REDEEM' && t.effectKey) && order.status !== 'PENDING') throw new LoyaltyError('INVALID_STATE', 'Novo resgate exige pedido pendente.')
    const user = await client.user.findUnique({ where: { id_lojaID: { id: params.userID, lojaID: params.lojaID } }, select: { status: true } })
    if (user?.status !== 'ACTIVE') throw new LoyaltyError('USER_NOT_FOUND', 'Conta indisponível para resgate.')
    const state = await lockLoyaltyWallet(client, params)
    if (!state) throw new LoyaltyError('INSUFFICIENT_POINTS', 'Saldo insuficiente para resgate.')
    if (order.loyaltyTransactions.some(t => t.type === 'REDEEM' && !t.effectKey)) throw new LoyaltyError('RECONCILIATION_REQUIRED', 'Pedido com resgate legado.')
    const result = await debitLockedLoyalty(state, { ...loyaltyEffect('redeem', params, params.orderId, [params.points, params.monetaryValue, params.description ?? null]),
      type: 'REDEEM', points: -params.points, orderId: params.orderId, description: params.description ?? 'Resgate no pedido', monetaryValue: new Prisma.Decimal(params.monetaryValue) })
    return { pointsDebited: -result.transaction.points, newBalance: result.wallet.balance, transaction: result.transaction, replay: result.replay }
  })
}
export async function refundOrderPoints(params: RefundOrderPointsParams, tx?: Prisma.TransactionClient) {
  return inOrderTransaction(params.orderId, tx, async client => {
    const order = await scopedOrder(client, params.lojaID, params.orderId)
    if (!order.userID) {
      if (order.loyaltyTransactions.length) throw new LoyaltyError('INVALID_ORDER_OWNER', 'Pedido convidado com ledger de conta inconsistente.')
      return []
    }
    const originals = order.loyaltyTransactions.filter(t => t.type === 'EARN' || t.type === 'REDEEM')
    if (!originals.length) return []
    const scope = { lojaID: params.lojaID, userID: order.userID, orderId: order.id }
    const state = await lockLoyaltyWallet(client, scope)
    if (!state || !state.wallet.accountingReady || originals.some(t => t.availableDelta === null)) {
      await deferLegacyLoyalty(client, 'REFUND', scope, { reason: params.reason ?? null, originalTransactionIds: originals.map(t => t.id) })
      return []
    }
    if (originals.some(t => t.lojaID !== params.lojaID || t.userID !== order.userID)) {
      await deferLegacyLoyalty(client, 'REFUND', scope, { reason: 'LEDGER_OWNER_DIVERGENCE', originalTransactionIds: originals.map(t => t.id) })
      return []
    }
    const settings = await getLoyaltySettings(params.lojaID, client)
    const results = []
    for (const original of originals.filter(t => t.type === 'EARN')) results.push(await reverseEarnLockedLoyalty(state, original, params.reason ?? 'Estorno de pontos ganhos'))
    for (const original of originals.filter(t => t.type === 'REDEEM')) results.push(await restoreRedeemLockedLoyalty(state, original, params.reason ?? 'Devolução de pontos resgatados', settings.loyaltyPointsExpiryDays))
    return results
  })
}
export async function adjustPointsManually(params: ManualAdjustmentParams, tx?: Prisma.TransactionClient) {
  const data = AdjustLoyaltyBalanceSchema.parse(params)
  const run = async (client: Prisma.TransactionClient) => {
    const admin = await client.user.findUnique({ where: { id_lojaID: { id: data.adminUserId, lojaID: data.lojaID } }, select: { role: true, status: true } })
    if (admin?.status !== 'ACTIVE' || admin.role !== 'ADMIN') throw new LoyaltyError('FORBIDDEN', 'Administrador ativo da loja obrigatório.')
    const user = await client.user.findUnique({ where: { id_lojaID: { id: data.userID, lojaID: data.lojaID } }, select: { status: true } })
    if (user?.status !== 'ACTIVE') throw new LoyaltyError('USER_NOT_FOUND', 'O usuário não pertence a esta loja ou não está ativo.')
    const state = await lockLoyaltyWallet(client, data, true)
    if (!state) throw new LoyaltyError('WALLET_NOT_FOUND', 'Carteira não encontrada.')
    const expiry = data.expiresAt ? new Date(data.expiresAt) : null
    const effect = { ...loyaltyEffect('adjust', data, data.commandId, [data.adminUserId, data.points, data.description, data.expiresAt ?? null]),
      type: LoyaltyTxType.ADMIN_ADJUSTMENT, points: data.points, description: data.description,
      expiry, policy: { actorId: data.adminUserId, commandId: data.commandId, explicitExpiry: data.expiresAt ?? null } }
    const existing = await client.loyaltyTransaction.findUnique({ where: { effectKey: effect.key } })
    if (!existing && ((expiry && expiry <= state.now) || (data.points < 0 && data.expiresAt))) throw new LoyaltyError('INVALID_POLICY', 'Validade exige crédito positivo e data futura.')
    return data.points > 0 ? creditLockedLoyalty(state, effect, [{ points: data.points, expiry }], data.points) : debitLockedLoyalty(state, effect)
  }
  return tx ? run(tx) : prisma.$transaction(run)
}
export async function reconcileLoyaltyWallet(lojaID: string, userID: string) {
  return prisma.$transaction(client => inspectLoyaltyAccounting(client, { lojaID, userID }))
}

/**
 * Retorna o extrato paginado das transações de pontos do usuário com isolamento multi-tenant.
 */
export async function getStatement(
  params: LoyaltyStatementParams
): Promise<LoyaltyStatementResult> {
  const { lojaID, userID, page = 1, limit = 20 } = params
  const skip = (Math.max(1, page) - 1) * Math.max(1, limit)
  const take = Math.min(100, Math.max(1, limit))

  const [items, total, summary] = await Promise.all([
    prisma.loyaltyTransaction.findMany({
      where: {
        lojaID,
        userID,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    }),
    prisma.loyaltyTransaction.count({
      where: {
        lojaID,
        userID,
      },
    }),
    getWalletSummary(lojaID, userID),
  ])

  return {
    items: items.map((t) => ({
      id: t.id,
      type: t.type,
      points: t.points,
      balanceAfter: t.balanceAfter,
      monetaryValue: t.monetaryValue ? Number(t.monetaryValue.toString()) : null,
      description: t.description,
      orderId: t.orderId,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    })),
    total,
    page: Math.max(1, page),
    limit: take,
    totalPages: Math.ceil(total / take),
    wallet: {
      balance: summary.balance,
      debt: summary.debt,
      accountingReady: summary.accountingReady,
      pending: summary.pending,
      lifetimeEarn: summary.lifetimeEarn,
      monetaryBalance: summary.monetaryBalance,
    },
  }
}

// ─── Rotina de Expiração de Pontos (ACT-P2-05) ───────────────────

/** Read-only estimate: currentBalance is never a debit authority. */
export async function calculateExpiredPointsForUser(lojaID: string, userID: string, _currentBalance: number, now = new Date(), client: Prisma.TransactionClient | typeof prisma = prisma): Promise<number> {
  const wallet = await client.loyaltyWallet.findUnique({ where: { lojaID_userID: { lojaID, userID } } })
  if (!wallet?.accountingReady) return 0
  const result = await client.loyaltyLot.aggregate({ where: { walletId: wallet.id, expiresAt: { lte: now } }, _sum: { remaining: true } })
  return result._sum.remaining ?? 0
}
export async function expireUserPoints(params: ExpireLoyaltyPointsParams, tx?: Prisma.TransactionClient) {
  const run = async (client: Prisma.TransactionClient) => {
    const state = await lockLoyaltyWallet(client, params, false, params.now ?? new Date())
    if (!state || !state.wallet.accountingReady) return null
    const result = await expireLockedLoyalty(state)
    return result.pointsExpired ? result : null
  }
  return tx ? run(tx) : prisma.$transaction(run)
}
export async function processLoyaltyExpirations(options: ProcessLoyaltyExpirationsOptions = {}): Promise<ProcessLoyaltyExpirationsResult> {
  const now = options.now ?? new Date()
  if (!Number.isFinite(now.getTime())) throw new LoyaltyError('INVALID_DATE', 'Data de expiração inválida.')
  const errors: ProcessLoyaltyExpirationsResult['errors'] = []
  let processedWallets = 0, expiredCount = 0, totalPointsExpired = 0
  const skippedLegacyWallets = await prisma.loyaltyWallet.count({ where: { accountingReady: false, ...(options.lojaID ? { lojaID: options.lojaID } : {}) } })
  let cursor: string | undefined
  while (true) {
    const wallets = await prisma.loyaltyWallet.findMany({ where: { accountingReady: true,
      ...(options.lojaID ? { lojaID: options.lojaID } : {}), lots: { some: { remaining: { gt: 0 }, expiresAt: { lte: now } } } },
      select: { id: true, lojaID: true, userID: true }, orderBy: { id: 'asc' }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
    if (!wallets.length) break
    for (const wallet of wallets) {
      processedWallets++
      const leaseOwner = randomUUID()
      try {
        const leaseNow = new Date()
        const claimed = await prisma.loyaltyWallet.updateMany({ where: { id: wallet.id, accountingReady: true,
          OR: [{ expirationLeaseUntil: null }, { expirationLeaseUntil: { lte: leaseNow } }] },
          data: { expirationLeaseOwner: leaseOwner, expirationLeaseUntil: new Date(leaseNow.getTime() + 60000) } })
        if (!claimed.count) continue
        const result = await expireUserPoints({ lojaID: wallet.lojaID, userID: wallet.userID, now })
        if (result) { expiredCount++; totalPointsExpired += result.pointsExpired }
      } catch (error: unknown) {
        errors.push({ userId: wallet.userID, lojaId: wallet.lojaID, error: error instanceof LoyaltyError ? error.code : 'EXPIRATION_FAILED' })
      } finally {
        try {
          await prisma.loyaltyWallet.updateMany({ where: { id: wallet.id, expirationLeaseOwner: leaseOwner },
            data: { expirationLeaseOwner: null, expirationLeaseUntil: null } })
        } catch {
          errors.push({ userId: wallet.userID, lojaId: wallet.lojaID, error: 'LEASE_RELEASE_FAILED' })
        }
      }
    }
    cursor = wallets.at(-1)!.id
  }
  return { processedWallets, expiredCount, totalPointsExpired, errors, skippedLegacyWallets }
}
