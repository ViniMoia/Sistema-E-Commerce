import { Prisma } from '@prisma/client';
import { CUSTOMER_FINANCIAL_POLICY, type CustomerFinancialSummary } from '@/lib/commerce/customer-metrics-contract';

type SummaryRow = {
  userID: string; totalOrders: bigint; recognizedOrderCount: bigint; unverifiedOrders: bigint; financialReviewOrders: bigint;
  totalOrderValue: Prisma.Decimal; totalMerchandiseOrdered: Prisma.Decimal; recognizedGross: Prisma.Decimal;
  settledGross: Prisma.Decimal; confirmedRefunds: Prisma.Decimal; totalSpent: Prisma.Decimal; averageOrderValue: Prisma.Decimal;
  firstOrderAt: Date | null; lastOrderAt: Date | null; cancelledOrders: bigint; asOf: Date; recognizedActiveOrderIds: string[];
};
const counts = ['totalOrders', 'recognizedOrderCount', 'unverifiedOrders', 'financialReviewOrders', 'cancelledOrders'] as const;
const amounts = ['totalOrderValue', 'totalMerchandiseOrdered', 'recognizedGross', 'settledGross', 'confirmedRefunds', 'totalSpent', 'averageOrderValue'] as const;

/** Read under the caller's repeatable-read snapshot. No cache/projection/writes.
 * AUTHORIZED and SETTLED describe the same principal, not two sales.
 * Charge refunds are full-charge facts (current DB provenance); attempt-level
 * refunds have distinct operation identities and may represent partial refunds.
 */
export async function readCustomerFinancialSummaries(tx: Prisma.TransactionClient, lojaID: string, userIDs: string[], includeOrderIds = false) {
  if (!lojaID) throw new Error('ACCOUNT_ACCESS_DENIED');
  if (!userIDs.length) return new Map<string, CustomerFinancialSummary & { recognizedActiveOrderIds: string[] }>();
  const rows = await tx.$queryRaw<SummaryRow[]>(Prisma.sql`
    WITH scope AS (
      SELECT o.* FROM "Order" o JOIN "User" u ON u.id=o."userID" AND u."lojaID"=o."lojaID"
      WHERE o."lojaID"=${lojaID} AND o."userID" IN (${Prisma.join(userIDs)})
    ), instruments AS (
      SELECT f."orderId", f."attemptId", f."chargeId", f.provider, f."providerAccount",
        COALESCE(MAX(f.amount) FILTER (WHERE f.type IN ('AUTHORIZED','SETTLED')),0) AS gross,
        COALESCE(MAX(f.amount) FILTER (WHERE f.type='SETTLED'),0) AS settled,
        CASE WHEN f."chargeId" IS NOT NULL THEN COALESCE(MAX(f.amount) FILTER (WHERE f.type='REFUNDED'),0)
          ELSE COALESCE(SUM(f.amount) FILTER (WHERE f.type='REFUNDED'),0) END AS refunded,
        COUNT(DISTINCT f.amount) FILTER (WHERE f.type IN ('AUTHORIZED','SETTLED'))>1 OR
          BOOL_OR(f."attemptId" IS NULL OR f."occurredAt">transaction_timestamp()) AS invalid
      FROM "FinancialFact" f JOIN scope o ON o.id=f."orderId"
      GROUP BY f."orderId",f."attemptId",f."chargeId",f.provider,f."providerAccount"
    ), attempts AS (
      SELECT i."orderId", i."attemptId", SUM(i.gross) AS gross, SUM(i.settled) AS settled, SUM(i.refunded) AS refunded,
        BOOL_OR(i.invalid) OR a.id IS NULL OR
        BOOL_OR(a."orderId"<>i."orderId" OR a.provider<>i.provider OR a."providerAccount" IS DISTINCT FROM i."providerAccount") OR
        (BOOL_OR(i."chargeId" IS NULL AND i.gross>0) AND BOOL_OR(i."chargeId" IS NOT NULL AND i.gross>0)) OR
        SUM(i.gross)>COALESCE(a."financialTotal",0) OR SUM(i.refunded)>SUM(i.gross) AS invalid
      FROM instruments i LEFT JOIN "PaymentAttempt" a ON a.id=i."attemptId"
      GROUP BY i."orderId",i."attemptId",a.id,a."financialTotal"
    ), funds AS (
      SELECT "orderId",
        COALESCE(SUM(gross) FILTER (WHERE NOT invalid),0) AS gross,
        COALESCE(SUM(settled) FILTER (WHERE NOT invalid),0) AS settled,
        COALESCE(SUM(refunded) FILTER (WHERE NOT invalid),0) AS refunded,
        BOOL_OR(invalid) AS invalid FROM attempts GROUP BY "orderId"
    ), orders AS (
      SELECT o.*, COALESCE(f.gross,0) AS gross, COALESCE(f.settled,0) AS settled, COALESCE(f.refunded,0) AS refunded,
        (o."checkoutIntentID" IS NULL AND f."orderId" IS NULL) AS unverified,
        COALESCE(f.invalid,false) OR COALESCE(f.gross,0)>COALESCE(o."financialTotal",o.total) OR EXISTS (
          SELECT 1 FROM "PaymentAttempt" a WHERE a."orderId"=o.id AND
            (a.status IN ('SUBMITTING','UNKNOWN') OR a."failureCode" ~ 'MISMATCH|CONFLICT|UNRESOLVED|EXTERNAL_STATE_REVIEW|PARTIAL_REVERSAL_REVIEW|RECONCILIATION_OVERDUE|REVERSAL_OVERDUE')
        ) AS review
      FROM scope o LEFT JOIN funds f ON f."orderId"=o.id
    )
    SELECT u.id AS "userID", COUNT(o.id) AS "totalOrders",
      COUNT(o.id) FILTER (WHERE o.gross>0) AS "recognizedOrderCount",
      COUNT(o.id) FILTER (WHERE o.unverified) AS "unverifiedOrders",
      COUNT(o.id) FILTER (WHERE o.review) AS "financialReviewOrders",
      COALESCE(SUM(COALESCE(o."financialTotal",o.total)),0) AS "totalOrderValue",
      COALESCE(SUM(o.subtotal),0) AS "totalMerchandiseOrdered",
      COALESCE(SUM(o.gross),0) AS "recognizedGross", COALESCE(SUM(o.settled),0) AS "settledGross",
      COALESCE(SUM(o.refunded),0) AS "confirmedRefunds", COALESCE(SUM(o.gross-o.refunded),0) AS "totalSpent",
      COALESCE(ROUND(SUM(o.gross-o.refunded)/NULLIF(COUNT(o.id) FILTER (WHERE o.gross>0),0),2),0) AS "averageOrderValue",
      MIN(o."createdAt") AS "firstOrderAt", MAX(o."createdAt") AS "lastOrderAt",
      COUNT(o.id) FILTER (WHERE o.status='CANCELLED') AS "cancelledOrders", transaction_timestamp() AS "asOf",
      ${includeOrderIds ? Prisma.sql`COALESCE(ARRAY_AGG(o.id) FILTER (WHERE o.gross>o.refunded AND o.status<>'CANCELLED'),ARRAY[]::text[])` : Prisma.sql`ARRAY[]::text[]`} AS "recognizedActiveOrderIds"
    FROM "User" u LEFT JOIN orders o ON o."userID"=u.id
    WHERE u."lojaID"=${lojaID} AND u.id IN (${Prisma.join(userIDs)})
    GROUP BY u.id
  `);
  return new Map(rows.map(row => {
    const integers = Object.fromEntries(counts.map(key => {
      const value = Number(row[key]); if (!Number.isSafeInteger(value) || value < 0) throw new Error('CUSTOMER_METRICS_RANGE_INVALID');
      return [key, value];
    })) as Pick<CustomerFinancialSummary, typeof counts[number]>;
    const monetary = Object.fromEntries(amounts.map(key => {
      const decimal = new Prisma.Decimal(row[key]);
      if (decimal.isNegative() || !decimal.times(100).isInteger() || decimal.times(100).gt(Number.MAX_SAFE_INTEGER)) throw new Error('CUSTOMER_METRICS_RANGE_INVALID');
      return [key, decimal.toNumber()];
    })) as Pick<CustomerFinancialSummary, typeof amounts[number]>;
    return [row.userID, { ...integers, ...monetary, policy: CUSTOMER_FINANCIAL_POLICY, currency: 'BRL' as const,
      coverage: integers.unverifiedOrders || integers.financialReviewOrders ? 'PARTIAL' as const : 'COMPLETE' as const,
      asOf: row.asOf.toISOString(), firstOrderAt: row.firstOrderAt?.toISOString() ?? null,
      lastOrderAt: row.lastOrderAt?.toISOString() ?? null, recognizedActiveOrderIds: row.recognizedActiveOrderIds }];
  }));
}
