import { financialEvidenceCtes } from '@/lib/commerce/financial-evidence';
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
    WITH ${financialEvidenceCtes(Prisma.sql`
      SELECT o.* FROM "Order" o JOIN "User" u ON u.id=o."userID" AND u."lojaID"=o."lojaID"
      WHERE o."lojaID"=${lojaID} AND o."userID" IN (${Prisma.join(userIDs)})
        AND NOT EXISTS (SELECT 1 FROM "OrderReportingExclusion" x WHERE x."orderId"=o.id)
`)}
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
