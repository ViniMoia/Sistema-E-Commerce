import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { orderReportingWhere } from '@/lib/commerce/order-reporting';
import { calculateDiscountFromPoints, getLoyaltySettings } from '@/services/loyalty.service';

/** Reporting only: classification never changes wallet balances or ledger entries. */
export async function readLoyaltyReport(lojaID: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const settings = await getLoyaltySettings(lojaID, tx);
    const types = ['EARN', 'REFUND_EARN', 'REDEEM', 'REFUND_REDEEM'] as const;
    const scope: Prisma.LoyaltyTransactionWhereInput = {
      lojaID, type: { in: [...types] },
      order: { is: { lojaID, ...orderReportingWhere() } },
    };
    const [wallets, active, legacyWallets, groups, unlinked, recent] = await Promise.all([
      tx.loyaltyWallet.aggregate({ where: { lojaID }, _sum: { balance: true, debt: true, lifetimeEarn: true } }),
      tx.loyaltyWallet.count({ where: { lojaID, balance: { gt: 0 } } }),
      tx.loyaltyWallet.count({ where: { lojaID, accountingReady: false } }),
      tx.loyaltyTransaction.groupBy({ by: ['type'], where: scope,
        _sum: { points: true, monetaryValue: true }, _count: { _all: true, monetaryValue: true } }),
      tx.loyaltyTransaction.count({ where: { lojaID, type: { in: [...types] },
        OR: [{ orderId: null }, { order: { is: { lojaID: { not: lojaID } } } }] } }),
      tx.loyaltyTransaction.findMany({ where: { lojaID }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10,
        include: { user: { select: { name: true, email: true } },
          order: { select: { reportingExclusion: { select: { orderId: true } } } } } }),
    ]);
    const group = (type: typeof types[number]) => groups.find(g => g.type === type);
    const points = (type: typeof types[number]) => group(type)?._sum.points ?? 0;
    const money = (type: typeof types[number]) => group(type)?._sum.monetaryValue ?? new Prisma.Decimal(0);
    const missing = (type: typeof types[number]) => (group(type)?._count._all ?? 0) - (group(type)?._count.monetaryValue ?? 0);
    // Null historical values remain unknown; current point value is only a wallet estimate.
    const missingMonetaryValues = missing('REDEEM') + missing('REFUND_REDEEM');
    const commercial = {
      earnedPoints: points('EARN'), reversedEarnedPoints: 0 - points('REFUND_EARN'),
      redeemedPoints: 0 - points('REDEEM'), returnedPoints: points('REFUND_REDEEM'),
      netRedeemedPoints: 0 - points('REDEEM') - points('REFUND_REDEEM'),
      redeemedValue: money('REDEEM').toNumber(), returnedValue: money('REFUND_REDEEM').toNumber(),
      netRedeemedValue: money('REDEEM').minus(money('REFUND_REDEEM')).toNumber(),
      missingMonetaryValues, unlinkedTransactions: unlinked,
      coverage: missingMonetaryValues || unlinked ? 'PARTIAL' as const : 'COMPLETE' as const,
    };
    return {
      settings,
      metrics: {
        totalCirculatingPoints: wallets._sum.balance ?? 0,
        totalDebtPoints: wallets._sum.debt ?? 0,
        projectedFinancialLiability: calculateDiscountFromPoints(wallets._sum.balance ?? 0, settings.loyaltyPointValue),
        activeCustomersWithPoints: active,
        // Wallet accumulator includes adjustments/reversals and is not gross commercial earnings.
        totalLifetimeEarnedPoints: wallets._sum.lifetimeEarn ?? 0,
        legacyWallets,
        totalRedeemedPoints: commercial.redeemedPoints,
        totalRedeemedMonetaryValue: commercial.redeemedValue,
        commercial,
      },
      recentTransactions: recent.map(t => ({ id: t.id, userName: t.user.name, userEmail: t.user.email,
        type: t.type, points: t.points, balanceAfter: t.balanceAfter,
        monetaryValue: t.monetaryValue?.toNumber() ?? null, description: t.description,
        orderId: t.orderId, isTestOrder: Boolean(t.order?.reportingExclusion), createdAt: t.createdAt.toISOString() })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
