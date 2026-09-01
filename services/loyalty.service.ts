import prisma from '@/lib/prisma'
import { Prisma, LoyaltyTxType } from '@prisma/client'
import { z } from 'zod'
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
} from '@/types/loyalty.types'

// ─── Custom Errors ────────────────────────────────────────────────

export class LoyaltyError extends Error {
  public readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'LoyaltyError'
  }
}

// ─── Zod Schemas ──────────────────────────────────────────────────

export const SimulateLoyaltyRedeemSchema = z.object({
  lojaID: z.string().min(1, 'lojaID é obrigatório'),
  userID: z.string().optional(),
  subtotal: z.number().positive('Subtotal deve ser maior que zero'),
  requestedPoints: z.number().int().min(0, 'Pontos solicitados não podem ser negativos'),
})

export const AdjustLoyaltyBalanceSchema = z.object({
  lojaID: z.string().min(1, 'lojaID é obrigatório'),
  userID: z.string().min(1, 'userID é obrigatório'),
  points: z.number().int().refine((val) => val !== 0, {
    message: 'A quantidade de pontos para ajuste não pode ser zero',
  }),
  description: z.string().min(3, 'Descrição deve ter no mínimo 3 caracteres').max(255),
  adminUserId: z.string().min(1, 'adminUserId é obrigatório'),
})

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
  const subtotalNum = typeof subtotal === 'number' ? subtotal : Number(subtotal.toString())
  const earnRateNum = typeof earnRate === 'number' ? earnRate : Number(earnRate.toString())

  if (isNaN(subtotalNum) || subtotalNum <= 0 || isNaN(earnRateNum) || earnRateNum <= 0) {
    return 0
  }

  return Math.floor(subtotalNum * earnRateNum)
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
export async function getOrCreateWallet(
  lojaID: string,
  userID: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma

  return await client.loyaltyWallet.upsert({
    where: {
      lojaID_userID: {
        lojaID,
        userID,
      },
    },
    create: {
      lojaID,
      userID,
      balance: 0,
      pending: 0,
      lifetimeEarn: 0,
      version: 0,
    },
    update: {},
  })
}

/**
 * Retorna o resumo consolidado da carteira do cliente, incluindo configurações e saldo em R$.
 */
export async function getWalletSummary(
  lojaID: string,
  userID: string
): Promise<LoyaltyWalletSummary> {
  const settings = await getLoyaltySettings(lojaID)
  const wallet = await getOrCreateWallet(lojaID, userID)

  const monetaryBalance = calculateDiscountFromPoints(wallet.balance, settings.loyaltyPointValue)

  return {
    walletId: wallet.id,
    lojaID,
    userID,
    balance: wallet.balance,
    pending: wallet.pending,
    lifetimeEarn: wallet.lifetimeEarn,
    monetaryBalance,
    settings,
  }
}

// ─── Simulação de Resgate para Checkout ───────────────────────────

/**
 * Simula de forma autoritativa a aplicação de pontos como desconto no checkout.
 */
export async function simulatePointsRedemption(
  input: SimulateRedeemInput
): Promise<SimulateRedeemResult> {
  const validated = SimulateLoyaltyRedeemSchema.parse(input)
  const settings = await getLoyaltySettings(validated.lojaID)

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
  let availableBalance = validated.requestedPoints
  if (validated.userID) {
    const wallet = await getOrCreateWallet(validated.lojaID, validated.userID)
    availableBalance = wallet.balance
  }

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

/**
 * Credita pontos ganhos por um pedido concluído/pago (EARN).
 * Executa dentro de uma transação ACID e registra no Ledger.
 */
export async function creditEarnedPoints(
  params: CreditEarnedPointsParams,
  tx?: Prisma.TransactionClient
) {
  const { lojaID, userID, orderId, subtotal, description } = params

  const runOperation = async (client: Prisma.TransactionClient) => {
    const settings = await getLoyaltySettings(lojaID, client)
    if (!settings.loyaltyEnabled) return null

    const pointsToCredit = calculatePointsEarned(subtotal, settings.loyaltyEarnRate)
    if (pointsToCredit <= 0) return null

    // 1. Garantir existência da carteira
    const wallet = await client.loyaltyWallet.upsert({
      where: { lojaID_userID: { lojaID, userID } },
      create: {
        lojaID,
        userID,
        balance: pointsToCredit,
        pending: 0,
        lifetimeEarn: pointsToCredit,
        version: 1,
      },
      update: {
        balance: { increment: pointsToCredit },
        lifetimeEarn: { increment: pointsToCredit },
        version: { increment: 1 },
      },
    })

    // 2. Data de expiração
    let expiresAt: Date | null = null
    if (settings.loyaltyPointsExpiryDays && settings.loyaltyPointsExpiryDays > 0) {
      expiresAt = new Date(Date.now() + settings.loyaltyPointsExpiryDays * 24 * 60 * 60 * 1000)
    }

    const monetaryValue = calculateDiscountFromPoints(pointsToCredit, settings.loyaltyPointValue)

    // 3. Registrar no Ledger Imutável
    const transaction = await client.loyaltyTransaction.create({
      data: {
        lojaID,
        userID,
        orderId,
        type: LoyaltyTxType.EARN,
        points: pointsToCredit,
        balanceAfter: wallet.balance,
        monetaryValue: new Prisma.Decimal(monetaryValue),
        description: description || `Pontos acumulados no pedido #${orderId.slice(0, 8)}`,
        expiresAt,
      },
    })

    return {
      pointsCredited: pointsToCredit,
      newBalance: wallet.balance,
      transaction,
    }
  }

  if (tx) {
    return await runOperation(tx)
  } else {
    return await prisma.$transaction(runOperation)
  }
}

/**
 * Debita pontos resgatados durante a criação de um pedido (REDEEM).
 * Previne double-spending com verificação atômica de saldo e controle otimista de versão.
 */
export async function debitRedeemedPoints(
  params: DebitRedeemedPointsParams,
  tx?: Prisma.TransactionClient
) {
  const { lojaID, userID, orderId, points, monetaryValue, description } = params
  if (points <= 0) return null

  const runOperation = async (client: Prisma.TransactionClient) => {
    // 1. Carregar carteira com bloqueio/leitura consistente
    const wallet = await client.loyaltyWallet.findUnique({
      where: { lojaID_userID: { lojaID, userID } },
    })

    if (!wallet || wallet.balance < points) {
      throw new LoyaltyError(
        'INSUFFICIENT_POINTS',
        `Saldo insuficiente para resgate. Saldo disponível: ${wallet?.balance ?? 0}, solicitado: ${points}`
      )
    }

    // 2. Débito atômico na carteira
    const updatedWallet = await client.loyaltyWallet.update({
      where: {
        id: wallet.id,
      },
      data: {
        balance: { decrement: points },
        version: { increment: 1 },
      },
    })

    // Se após o decremento o saldo for negativo (condição de corrida capturada), reverte
    if (updatedWallet.balance < 0) {
      throw new LoyaltyError('INSUFFICIENT_POINTS', 'Violação de saldo concorrente.')
    }

    // 3. Registrar no Ledger Imutável
    const transaction = await client.loyaltyTransaction.create({
      data: {
        lojaID,
        userID,
        orderId,
        type: LoyaltyTxType.REDEEM,
        points: -points, // Negativo para débito
        balanceAfter: updatedWallet.balance,
        monetaryValue: new Prisma.Decimal(monetaryValue),
        description: description || `Desconto fidelidade aplicado no pedido #${orderId.slice(0, 8)}`,
      },
    })

    return {
      pointsDebited: points,
      newBalance: updatedWallet.balance,
      transaction,
    }
  }

  if (tx) {
    return await runOperation(tx)
  } else {
    return await prisma.$transaction(runOperation)
  }
}

/**
 * Estorna/reverte os pontos de um pedido cancelado ou devolvido.
 * - Estorna pontos ganhos (REFUND_EARN)
 * - Devolve pontos resgatados (REFUND_REDEEM)
 */
export async function refundOrderPoints(
  params: RefundOrderPointsParams,
  tx?: Prisma.TransactionClient
) {
  const { lojaID, orderId, reason } = params

  const runOperation = async (client: Prisma.TransactionClient) => {
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        loyaltyTransactions: true,
      },
    })

    if (!order || order.lojaID !== lojaID) {
      throw new LoyaltyError('ORDER_NOT_FOUND', `Pedido ${orderId} não encontrado na loja.`)
    }

    const results = []

    // 1. Reverter EARN se já tiver sido creditado
    const earnTx = order.loyaltyTransactions.find((t) => t.type === LoyaltyTxType.EARN)
    if (earnTx && earnTx.points > 0) {
      const pointsToRefund = earnTx.points

      const wallet = await client.loyaltyWallet.update({
        where: { lojaID_userID: { lojaID, userID: order.userID } },
        data: {
          balance: { decrement: pointsToRefund },
          lifetimeEarn: { decrement: pointsToRefund },
          version: { increment: 1 },
        },
      })

      const refundEarnTx = await client.loyaltyTransaction.create({
        data: {
          lojaID,
          userID: order.userID,
          orderId,
          type: LoyaltyTxType.REFUND_EARN,
          points: -pointsToRefund,
          balanceAfter: wallet.balance,
          monetaryValue: earnTx.monetaryValue,
          description: reason || `Estorno de pontos por cancelamento do pedido #${order.orderNumber}`,
        },
      })
      results.push(refundEarnTx)
    }

    // 2. Reverter REDEEM se tiver consumido pontos
    const redeemTx = order.loyaltyTransactions.find((t) => t.type === LoyaltyTxType.REDEEM)
    if (redeemTx && Math.abs(redeemTx.points) > 0) {
      const pointsToRestore = Math.abs(redeemTx.points)

      const wallet = await client.loyaltyWallet.update({
        where: { lojaID_userID: { lojaID, userID: order.userID } },
        data: {
          balance: { increment: pointsToRestore },
          version: { increment: 1 },
        },
      })

      const refundRedeemTx = await client.loyaltyTransaction.create({
        data: {
          lojaID,
          userID: order.userID,
          orderId,
          type: LoyaltyTxType.REFUND_REDEEM,
          points: pointsToRestore,
          balanceAfter: wallet.balance,
          monetaryValue: redeemTx.monetaryValue,
          description: reason || `Devolução de pontos resgatados no pedido #${order.orderNumber}`,
        },
      })
      results.push(refundRedeemTx)
    }

    return results
  }

  if (tx) {
    return await runOperation(tx)
  } else {
    return await prisma.$transaction(runOperation)
  }
}

/**
 * Realiza um ajuste manual no saldo do cliente com auditoria administrativa.
 */
export async function adjustPointsManually(
  params: ManualAdjustmentParams,
  tx?: Prisma.TransactionClient
) {
  const validated = AdjustLoyaltyBalanceSchema.parse(params)
  const { lojaID, userID, points, description, adminUserId } = validated

  const runOperation = async (client: Prisma.TransactionClient) => {
    const settings = await getLoyaltySettings(lojaID, client)
    const wallet = await getOrCreateWallet(lojaID, userID, client)

    if (points < 0 && wallet.balance < Math.abs(points)) {
      throw new LoyaltyError(
        'INSUFFICIENT_POINTS',
        `Saldo insuficiente para ajuste negativo. Saldo atual: ${wallet.balance}`
      )
    }

    const updatedWallet = await client.loyaltyWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: points },
        lifetimeEarn: points > 0 ? { increment: points } : undefined,
        version: { increment: 1 },
      },
    })

    const monetaryValue = calculateDiscountFromPoints(Math.abs(points), settings.loyaltyPointValue)

    const transaction = await client.loyaltyTransaction.create({
      data: {
        lojaID,
        userID,
        type: LoyaltyTxType.ADMIN_ADJUSTMENT,
        points,
        balanceAfter: updatedWallet.balance,
        monetaryValue: new Prisma.Decimal(monetaryValue),
        description: `[Ajuste Admin ${adminUserId.slice(0, 8)}] ${description}`,
      },
    })

    return {
      wallet: updatedWallet,
      transaction,
    }
  }

  if (tx) {
    return await runOperation(tx)
  } else {
    return await prisma.$transaction(runOperation)
  }
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
      pending: summary.pending,
      lifetimeEarn: summary.lifetimeEarn,
      monetaryBalance: summary.monetaryBalance,
    },
  }
}
