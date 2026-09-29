import prisma from '@/lib/prisma'

const ACTIVE_STATUSES = ['PENDING', 'PROCESSING', 'RETRY_SCHEDULED'] as const

function configuredSlaMs(): number {
  const minutes = Number(process.env.PAYMENT_RECONCILIATION_SLA_MINUTES ?? 15)
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : 15 * 60_000
}

/** Persistent gauges: safe across process restarts and replicas, with no identifiers. */
export async function renderPaymentReconciliationMetrics(now = new Date()): Promise<string> {
  const slaBefore = new Date(now.getTime() - configuredSlaMs())
  const [groups, overSla, oldest] = await Promise.all([
    prisma.paymentReconciliation.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.paymentReconciliation.count({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        firstDetectedAt: { lt: slaBefore },
      },
    }),
    prisma.paymentReconciliation.findFirst({
      where: { status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { firstDetectedAt: 'asc' },
      select: { firstDetectedAt: true },
    }),
  ])

  const lines = [
    '# HELP payment_reconciliation_backlog Persistent reconciliation records by state.',
    '# TYPE payment_reconciliation_backlog gauge',
    ...groups.map((group) =>
      `payment_reconciliation_backlog{status="${group.status.toLowerCase()}"} ${group._count._all}`
    ),
    '# HELP payment_reconciliation_over_sla Reconciliations active beyond configured SLA.',
    '# TYPE payment_reconciliation_over_sla gauge',
    `payment_reconciliation_over_sla ${overSla}`,
    '# HELP payment_reconciliation_oldest_age_seconds Age of the oldest active reconciliation.',
    '# TYPE payment_reconciliation_oldest_age_seconds gauge',
    `payment_reconciliation_oldest_age_seconds ${oldest
      ? Math.max(0, Math.floor((now.getTime() - oldest.firstDetectedAt.getTime()) / 1000))
      : 0}`,
  ]
  return `${lines.join('\n')}\n`
}
