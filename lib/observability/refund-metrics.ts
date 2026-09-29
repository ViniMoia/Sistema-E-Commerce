import prisma from '@/lib/prisma'

const ACTIVE = ['REFUND_REQUESTED', 'PROCESSING', 'RECONCILIATION_REQUIRED'] as const

function slaMs(): number {
  const minutes = Number(process.env.REFUND_RECONCILIATION_SLA_MINUTES ?? 30)
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : 30 * 60_000
}

/** Gauges persistentes, sem IDs, valores ou qualquer dado do cliente. */
export async function renderRefundMetrics(now = new Date()): Promise<string> {
  const slaBefore = new Date(now.getTime() - slaMs())
  const [groups, overSla, oldest, confirmedEffectsPending] = await Promise.all([
    prisma.refundIntent.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.refundIntent.count({
      where: { status: { in: [...ACTIVE] }, createdAt: { lt: slaBefore } },
    }),
    prisma.refundIntent.findFirst({
      where: { status: { in: [...ACTIVE] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.refundIntent.count({
      where: { status: 'CONFIRMED', effectAppliedAt: null },
    }),
  ])
  return `${[
    '# HELP refund_reconciliation_backlog Persistent refund intents by state.',
    '# TYPE refund_reconciliation_backlog gauge',
    ...groups.map((group) =>
      `refund_reconciliation_backlog{status="${group.status.toLowerCase()}"} ${group._count._all}`
    ),
    '# HELP refund_reconciliation_over_sla Refund intents active beyond configured SLA.',
    '# TYPE refund_reconciliation_over_sla gauge',
    `refund_reconciliation_over_sla ${overSla}`,
    '# HELP refund_reconciliation_oldest_age_seconds Age of the oldest active refund intent.',
    '# TYPE refund_reconciliation_oldest_age_seconds gauge',
    `refund_reconciliation_oldest_age_seconds ${oldest
      ? Math.max(0, Math.floor((now.getTime() - oldest.createdAt.getTime()) / 1000))
      : 0}`,
    '# HELP refund_confirmed_effects_pending Provider-confirmed refunds with local effects pending.',
    '# TYPE refund_confirmed_effects_pending gauge',
    `refund_confirmed_effects_pending ${confirmedEffectsPending}`,
  ].join('\n')}\n`
}
