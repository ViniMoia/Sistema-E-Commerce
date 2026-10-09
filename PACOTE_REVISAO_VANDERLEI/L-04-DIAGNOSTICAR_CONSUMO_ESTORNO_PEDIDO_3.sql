-- Leno (Brega): executar no SQL Editor do banco/branch efetivos do Preview.
-- Somente leitura: nao altera prazo/lease/status, nao bloqueia linhas nem despacha REFUND.
-- Conferir a selecao do ambiente; IDs tambem podem existir em clones.
-- A elegibilidade abaixo espelha os filtros do consumidor; nao prova ausencia de
-- locks concorrentes, acesso pelo mesmo deployment nem estado remoto no Asaas.
WITH observed AS MATERIALIZED (
  SELECT clock_timestamp() AS now, current_setting('TimeZone') AS timezone
), target AS (
  SELECT o."id", o."orderNumber", o."lojaID", o."userID", o."version", o."status",
         o."asaasPaymentId", o."asaasPaymentStatus", o."total", o."paidAt",
         o."pointsRedeemed", o."pointsCredited"
  FROM public."Order" o
  WHERE o."id" = '5b5bef57-2fd2-4f88-83fd-bf3d76238c40'
    AND o."lojaID" = '3a82b33c-3646-4272-9a89-80bb1ba327a5'
    AND o."orderNumber" = 3
), attempts AS (
  SELECT a."id", a."orderId", a."number", a."provider", a."providerAccount", a."method",
         a."status", a."version", a."financialTotal", a."externalReference",
         a."reconcileAfter", a."reviewAfter", a."reconcileAttempts", a."failureCode",
         a."leaseExpiresAt", a."createdAt", a."updatedAt",
         a."leaseOwner" IS NOT NULL AS "leaseOwnerPresent",
         a."id" = '03422a6b-8223-41eb-9240-089c6dd9cf22' AS "expectedAttemptMatches",
         a."providerAccount" = 'sandbox-hml' AS "expectedAccountMatches",
         (a."reconcileAfter" IS NULL OR a."reconcileAfter" <= t.now) AS "reconcileDue",
         (a."leaseExpiresAt" IS NULL OR a."leaseExpiresAt" <= t.now) AS "leaseAvailable",
         (a."provider" = 'ASAAS'
           AND (a."reconcileAfter" IS NULL OR a."reconcileAfter" <= t.now)
           AND (a."leaseExpiresAt" IS NULL OR a."leaseExpiresAt" <= t.now)
           AND a."status" NOT IN ('DECLINED', 'CANCELLED', 'REFUNDED')) AS "eligibleByWorkerFilters"
  FROM public."PaymentAttempt" a JOIN target o ON a."orderId" = o."id"
  CROSS JOIN observed t
), charges AS (
  SELECT c."id", c."attemptId", c."provider", c."providerAccount", c."providerPaymentId",
         c."ordinal", c."amount", c."providerStatus", c."settledAt"
  FROM public."PaymentCharge" c JOIN attempts a ON c."attemptId" = a."id"
), operations AS (
  SELECT p."id", p."attemptId", p."chargeId", p."kind", p."status", p."createdAt",
         p."submittedAt", p."completedAt", p."lastErrorCode",
         p."id" = '895e8eec-8052-49ae-86b8-f35812003b7e' AS "expectedOperationMatches"
  FROM public."PaymentOperation" p JOIN attempts a ON p."attemptId" = a."id"
), facts AS (
  SELECT f."id", f."attemptId", f."chargeId", f."providerAccount", f."type", f."amount", f."factKey"
  FROM public."FinancialFact" f JOIN target o ON f."orderId" = o."id"
), inbox AS (
  SELECT b."id", b."provider", b."eventType", b."status", b."attempts",
         b."receivedAt", b."completedAt", b."nextAttemptAt", b."lastErrorCode"
  FROM public."PaymentInbox" b
  WHERE EXISTS (SELECT 1 FROM target)
    AND (b."payload" -> 'payment' ->> 'externalReference' = '5b5bef57-2fd2-4f88-83fd-bf3d76238c40'
      OR b."payload" -> 'payment' ->> 'id' = 'pay_cra35xq1ltkb6oka')
), outbox AS (
  SELECT b."id", b."commandType", b."status", b."attempts", b."nextAttemptAt",
         b."completedAt", b."lastErrorCode"
  FROM public."CommerceOutbox" b JOIN target o ON b."aggregateId" = o."id"
)
SELECT jsonb_build_object(
  'phase', 'refund_worker_diagnostic_read',
  'code', CASE WHEN EXISTS (SELECT 1 FROM target) THEN 'INTERNAL_STATE_READ' ELSE 'ORDER_SCOPE_NOT_FOUND' END,
  'at', (SELECT now FROM observed),
  'databaseTimeZone', (SELECT timezone FROM observed),
  'processingAttempted', false,
  'expectedOrderId', '5b5bef57-2fd2-4f88-83fd-bf3d76238c40',
  'expectedAccountScope', 'sandbox-hml',
  'orderCount', (SELECT count(*) FROM target),
  'order', (SELECT jsonb_build_object('version', o."version", 'status', o."status",
    'asaasPaymentId', o."asaasPaymentId", 'asaasPaymentStatus', o."asaasPaymentStatus",
    'total', o."total", 'paidAt', o."paidAt", 'pointsRedeemed', o."pointsRedeemed",
    'pointsCredited', o."pointsCredited") FROM target o),
  'attempts', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a."number", a."id") FROM attempts a), '[]'::jsonb),
  'charges', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c."id") FROM charges c), '[]'::jsonb),
  'operations', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p."id") FROM operations p), '[]'::jsonb),
  'financialFacts', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f."id") FROM facts f), '[]'::jsonb),
  'inboxForPayment', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b."receivedAt", b."id") FROM inbox b), '[]'::jsonb),
  'outboxForOrder', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b."id") FROM outbox b), '[]'::jsonb),
  'wallet', (SELECT jsonb_build_object('balance', w."balance", 'pending', w."pending", 'lifetimeEarn', w."lifetimeEarn")
    FROM public."LoyaltyWallet" w JOIN target o ON w."userID" = o."userID" AND w."lojaID" = o."lojaID"),
  'orderLoyaltyMovementCount', (SELECT count(*) FROM public."LoyaltyTransaction" l
    JOIN target o ON l."orderId" = o."id" AND l."lojaID" = o."lojaID")
) AS evidence;
