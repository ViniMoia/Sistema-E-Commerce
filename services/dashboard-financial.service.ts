import { Prisma } from '@prisma/client';
import { financialEvidenceCtes } from '@/lib/commerce/financial-evidence';
import type { DashboardFinancialEvidenceDTO } from '@/types/dashboard';

/** One database snapshot, including guests. Dates deliberately use first ledger
 * registration, not Order.createdAt/paidAt or an assumed bank settlement date. */
export async function readDashboardFinancial(tx: Prisma.TransactionClient, lojaID: string): Promise<DashboardFinancialEvidenceDTO> {
  if (!lojaID) throw new Error('ACCOUNT_ACCESS_DENIED');
  const [row] = await tx.$queryRaw<{ data: DashboardFinancialEvidenceDTO }[]>(Prisma.sql`
    WITH ${financialEvidenceCtes(Prisma.sql`
      SELECT o.* FROM "Order" o WHERE o."lojaID"=${lojaID}
      AND NOT EXISTS (SELECT 1 FROM "OrderReportingExclusion" x WHERE x."orderId"=o.id)
    `)}, valid_instruments AS (
      SELECT i.* FROM instruments i JOIN attempts a ON a."attemptId"=i."attemptId" AND a."orderId"=i."orderId" WHERE NOT a.invalid
    ), events AS (
      SELECT "orderId", 'RECOGNIZED' AS kind, gross AS amount, "recognizedAt" AS at FROM valid_instruments WHERE gross>0
      UNION ALL SELECT "orderId", 'SETTLED', settled, "settledAt" FROM valid_instruments WHERE settled>0
      UNION ALL SELECT "orderId", 'REFUNDED', refunded, "refundedAt" FROM valid_instruments WHERE refunded>0 AND "chargeId" IS NOT NULL
      UNION ALL SELECT f."orderId", 'REFUNDED', f.amount, f."createdAt" FROM "FinancialFact" f
        JOIN attempts a ON a."attemptId"=f."attemptId" AND a."orderId"=f."orderId"
        WHERE NOT a.invalid AND f.type='REFUNDED' AND f."chargeId" IS NULL
    ), boundaries AS (
      SELECT date_trunc('day',transaction_timestamp() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo' AT TIME ZONE 'UTC' AS day,
        date_trunc('month',transaction_timestamp() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo' AT TIME ZONE 'UTC' AS month
    ), periods AS (
      SELECT 'today' AS name, day AS start FROM boundaries UNION ALL
      SELECT 'month',month FROM boundaries UNION ALL SELECT 'allTime','-infinity'::timestamp
    ), period_totals AS (
      SELECT p.name, jsonb_build_object(
        'recognizedGross',COALESCE(SUM(e.amount) FILTER (WHERE kind='RECOGNIZED'),0),
        'settledGross',COALESCE(SUM(e.amount) FILTER (WHERE kind='SETTLED'),0),
        'confirmedRefunds',COALESCE(SUM(e.amount) FILTER (WHERE kind='REFUNDED'),0),
        'netRecognized',COALESCE(SUM(CASE WHEN kind='RECOGNIZED' THEN e.amount WHEN kind='REFUNDED' THEN -e.amount ELSE 0 END),0),
        'recognizedOrderCount',COUNT(DISTINCT e."orderId") FILTER (WHERE kind='RECOGNIZED'),
        'settledOrderCount',COUNT(DISTINCT e."orderId") FILTER (WHERE kind='SETTLED'),
        'refundedOrderCount',COUNT(DISTINCT e."orderId") FILTER (WHERE kind='REFUNDED')
      ) AS data FROM periods p LEFT JOIN events e ON e.at>=p.start AND e.at<=transaction_timestamp() AT TIME ZONE 'UTC' GROUP BY p.name
    ), composition AS (
      SELECT o.*, (gross>0 AND gross=o."financialTotal" AND o.total=o.subtotal-o."pointsDiscountValue"+o."shippingCost"
        AND o."financialTotal"=o.total+o."financingCharge" AND o.subtotal>=o."pointsDiscountValue" AND NOT review) AS complete FROM orders o
    ), summary AS (
      SELECT jsonb_build_object(
        'totalOrdersCount',COUNT(*),
        'paidOrdersCount',COUNT(*) FILTER (WHERE status IN ('PAID','SHIPPED','DELIVERED')),
        'pendingOrdersCount',COUNT(*) FILTER (WHERE status='PENDING'),
        'cancelledOrdersCount',COUNT(*) FILTER (WHERE status='CANCELLED'),
        'unverifiedOrders',COUNT(*) FILTER (WHERE unverified),
        'financialReviewOrders',COUNT(*) FILTER (WHERE review),
        'coverage',CASE WHEN COUNT(*) FILTER (WHERE unverified OR review)>0 THEN 'PARTIAL' ELSE 'COMPLETE' END,
        'pendingOrderValue',COALESCE(SUM(GREATEST(COALESCE("financialTotal",total)-gross,0)) FILTER (WHERE status='PENDING' AND NOT unverified AND NOT review),0),
        'cancelledUnpaidOrderValue',COALESCE(SUM(COALESCE("financialTotal",total)) FILTER (WHERE status='CANCELLED' AND gross=0 AND NOT unverified AND NOT review),0),
        'cancelledUnpaidOrderCount',COUNT(*) FILTER (WHERE status='CANCELLED' AND gross=0 AND NOT unverified AND NOT review),
        'averageNetTicket',COALESCE(ROUND(SUM(gross-refunded)/NULLIF(COUNT(*) FILTER (WHERE gross>0),0),2),0),
        'paymentConversionRatePct',COALESCE(ROUND(100.0*COUNT(*) FILTER (WHERE gross>0)/NULLIF(COUNT(*),0)),0),
        'composition',jsonb_build_object(
          'merchandiseAfterDiscount',COALESCE(SUM(subtotal-"pointsDiscountValue") FILTER (WHERE complete),0),
          'shipping',COALESCE(SUM("shippingCost") FILTER (WHERE complete),0),
          'financingCharge',COALESCE(SUM("financingCharge") FILTER (WHERE complete),0),
          'unallocatedRecognized',COALESCE(SUM(gross) FILTER (WHERE complete IS NOT TRUE),0)
        )
      ) AS data FROM composition
    ) SELECT summary.data || (SELECT jsonb_object_agg(name,data) FROM period_totals) || jsonb_build_object(
      'policy','RECORDED_FINANCIAL_FACTS_V1','timeBasis','FACT_CREATED_AT','timezone','America/Sao_Paulo','currency','BRL',
      'asOf',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) AS data FROM summary
  `);
  // JSON numeric conversion must never silently accept unsafe monetary ranges.
  function validate(value: unknown, key = ''): void {
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100)) || (value < 0 && key !== 'netRecognized')) throw new Error('DASHBOARD_METRICS_RANGE_INVALID');
    } else if (value && typeof value === 'object') for (const [k,v] of Object.entries(value)) validate(v,k);
  }
  if (!row) throw new Error('DASHBOARD_METRICS_MISSING');
  validate(row.data);
  return row.data;
}
