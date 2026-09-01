import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth/guards'
import { getLoyaltySettings, calculateDiscountFromPoints } from '@/services/loyalty.service'
import { LoyaltyTxType } from '@prisma/client'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const lojaID = auth.user.lojaID

  try {
    const settings = await getLoyaltySettings(lojaID)

    // Agregações de saldo e passivo financeiro
    const [
      activeWalletsCount,
      walletsAggregate,
      earnedAggregate,
      redeemedAggregate,
      recentTransactions,
    ] = await Promise.all([
      // Total de clientes com saldo > 0
      prisma.loyaltyWallet.count({
        where: {
          lojaID,
          balance: { gt: 0 },
        },
      }),
      // Soma total de pontos em circulação
      prisma.loyaltyWallet.aggregate({
        where: { lojaID },
        _sum: {
          balance: true,
          lifetimeEarn: true,
        },
      }),
      // Total de pontos concedidos na história
      prisma.loyaltyTransaction.aggregate({
        where: {
          lojaID,
          type: LoyaltyTxType.EARN,
        },
        _sum: {
          points: true,
        },
      }),
      // Total de pontos resgatados na história
      prisma.loyaltyTransaction.aggregate({
        where: {
          lojaID,
          type: LoyaltyTxType.REDEEM,
        },
        _sum: {
          points: true,
        },
      }),
      // Últimas 10 movimentações na loja
      prisma.loyaltyTransaction.findMany({
        where: { lojaID },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ])

    const totalCirculatingPoints = walletsAggregate._sum.balance || 0
    const totalLifetimeEarned = walletsAggregate._sum.lifetimeEarn || earnedAggregate._sum.points || 0
    const totalRedeemedPoints = Math.abs(redeemedAggregate._sum.points || 0)

    // Passivo financeiro projetado: total de pontos em circulação * valor do ponto
    const projectedFinancialLiability = calculateDiscountFromPoints(
      totalCirculatingPoints,
      settings.loyaltyPointValue
    )

    const totalRedeemedMonetaryValue = calculateDiscountFromPoints(
      totalRedeemedPoints,
      settings.loyaltyPointValue
    )

    return ok({
      settings,
      metrics: {
        totalCirculatingPoints,
        projectedFinancialLiability, // R$ estimado em passivo
        activeCustomersWithPoints: activeWalletsCount,
        totalLifetimeEarnedPoints: totalLifetimeEarned,
        totalRedeemedPoints,
        totalRedeemedMonetaryValue, // R$ economizados pelos clientes
      },
      recentTransactions: recentTransactions.map((tx) => ({
        id: tx.id,
        userName: tx.user.name,
        userEmail: tx.user.email,
        type: tx.type,
        points: tx.points,
        balanceAfter: tx.balanceAfter,
        monetaryValue: tx.monetaryValue ? Number(tx.monetaryValue.toString()) : null,
        description: tx.description,
        orderId: tx.orderId,
        createdAt: tx.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('[ADMIN_LOYALTY_REPORTS_ERROR]', error)
    return err(error?.message || 'Erro ao gerar relatório de fidelidade.', 500)
  }
}
