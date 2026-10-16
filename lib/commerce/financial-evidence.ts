import { Prisma } from '@prisma/client';

/** Shared principal/refund evidence policy. Caller supplies tenant-scoped commercial orders. */
export function financialEvidenceCtes(scope: Prisma.Sql) {
  return Prisma.sql`scope AS (${scope}),
instruments AS (
      SELECT f."orderId", f."attemptId", f."chargeId", f.provider, f."providerAccount",
        COALESCE(MAX(f.amount) FILTER (WHERE f.type IN ('AUTHORIZED','SETTLED')),0) AS gross,
        COALESCE(MAX(f.amount) FILTER (WHERE f.type='SETTLED'),0) AS settled,
        MIN(f."createdAt") FILTER (WHERE f.type IN ('AUTHORIZED','SETTLED')) AS "recognizedAt",
        MIN(f."createdAt") FILTER (WHERE f.type='SETTLED') AS "settledAt",
        MIN(f."createdAt") FILTER (WHERE f.type='REFUNDED') AS "refundedAt",
        CASE WHEN f."chargeId" IS NOT NULL THEN COALESCE(MAX(f.amount) FILTER (WHERE f.type='REFUNDED'),0)
          ELSE COALESCE(SUM(f.amount) FILTER (WHERE f.type='REFUNDED'),0) END AS refunded,
        COUNT(DISTINCT f.amount) FILTER (WHERE f.type IN ('AUTHORIZED','SETTLED'))>1 OR
          BOOL_OR(f."attemptId" IS NULL OR f."occurredAt">(transaction_timestamp() AT TIME ZONE 'UTC') OR f."createdAt">(transaction_timestamp() AT TIME ZONE 'UTC')) AS invalid
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
            (a.status IN ('SUBMITTING','UNKNOWN') OR a."failureCode" ~ 'MISMATCH|CONFLICT|UNRESOLVED|EXTERNAL_STATE_REVIEW|PARTIAL_REVERSAL_REVIEW|REFUND_CANCELLED_REVIEW|RECONCILIATION_OVERDUE|REVERSAL_OVERDUE')
        ) AS review
      FROM scope o LEFT JOIN funds f ON f."orderId"=o.id
    )`;
}
