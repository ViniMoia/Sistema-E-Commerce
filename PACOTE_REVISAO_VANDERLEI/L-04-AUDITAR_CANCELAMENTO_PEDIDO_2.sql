-- Leno (Brega): executar no SQL Editor do banco/branch usados pelo Preview.
-- Uma unica leitura. Nao altera dados nem processa filas.
-- O operador precisa conferir a selecao do ambiente: IDs podem existir em clones.
-- INTERNAL_STATE_READ indica leitura, nao aprovacao automatica do caso.
WITH target AS (
  SELECT o."id", o."orderNumber", o."lojaID", o."userID", o."version",
         o."status", o."paymentMethod", o."asaasPaymentId", o."asaasPaymentStatus",
         o."total", o."pointsRedeemed", o."pointsCredited", o."paidAt"
  FROM public."Order" o
  WHERE o."id" = 'e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0'
    AND o."lojaID" = '3a82b33c-3646-4272-9a89-80bb1ba327a5'
    AND o."orderNumber" = 2
), attempts AS (
  SELECT a."id", a."orderId", a."provider", a."providerAccount", a."method",
         a."status", a."externalReference", a."financialTotal", a."failureCode"
  FROM public."PaymentAttempt" a JOIN target o ON a."orderId" = o."id"
), charges AS (
  SELECT c."id", c."attemptId", c."provider", c."providerAccount", c."providerPaymentId",
         c."ordinal", c."amount", c."providerStatus", c."settledAt"
  FROM public."PaymentCharge" c JOIN attempts a ON c."attemptId" = a."id"
), operations AS (
  SELECT p."id", p."attemptId", p."chargeId", p."kind", p."status",
         p."completedAt", p."lastErrorCode"
  FROM public."PaymentOperation" p JOIN attempts a ON p."attemptId" = a."id"
), items AS (
  SELECT i."id", i."productId", i."productVariantsId", i."size", i."color", i."quantity"
  FROM public."OrderItem" i JOIN target o ON i."orderId" = o."id"
), reservations AS (
  SELECT r."id", r."orderItemId", r."productId", r."variantId", r."quantity",
         r."status", r."version", r."releasedAt",
         COALESCE(r."productId" = i."productId" AND r."variantId" = i."productVariantsId"
                  AND r."quantity" = i."quantity", false) AS "itemMatches"
  FROM public."InventoryReservation" r JOIN target o ON r."orderId" = o."id"
  LEFT JOIN items i ON i."id" = r."orderItemId"
), facts AS (
  SELECT f."id", f."attemptId", f."chargeId", f."provider", f."providerAccount",
         f."type", f."amount", f."factKey"
  FROM public."FinancialFact" f JOIN target o ON f."orderId" = o."id"
), history AS (
  SELECT h."id", h."status", h."previousStatus", h."orderVersion"
  FROM public."OrderStatusHistory" h JOIN target o ON h."orderId" = o."id"
), outbox AS (
  SELECT b."commandType", b."status", count(*) AS "count"
  FROM public."CommerceOutbox" b JOIN target o ON b."aggregateId" = o."id"
  GROUP BY b."commandType", b."status"
)
SELECT jsonb_build_object(
  'phase', 'internal_read',
  'code', CASE WHEN EXISTS (SELECT 1 FROM target) THEN 'INTERNAL_STATE_READ' ELSE 'ORDER_SCOPE_NOT_FOUND' END,
  'processingAttempted', false,
  'expectedOrderId', 'e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0',
  'expectedAccountScope', 'sandbox-hml',
  'orderCount', (SELECT count(*) FROM target),
  'order', (SELECT jsonb_build_object(
    'version', o."version", 'status', o."status", 'paymentMethod', o."paymentMethod",
    'asaasPaymentId', o."asaasPaymentId", 'asaasPaymentStatus', o."asaasPaymentStatus",
    'total', o."total", 'pointsRedeemed', o."pointsRedeemed",
    'pointsCredited', o."pointsCredited", 'paidAt', o."paidAt") FROM target o),
  'items', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i."id") FROM items i), '[]'::jsonb),
  'attempts', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a."id") FROM attempts a), '[]'::jsonb),
  'charges', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c."id") FROM charges c), '[]'::jsonb),
  'operations', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p."id") FROM operations p), '[]'::jsonb),
  'reservations', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r."id") FROM reservations r), '[]'::jsonb),
  'financialFacts', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f."id") FROM facts f), '[]'::jsonb),
  'history', COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h."id") FROM history h), '[]'::jsonb),
  'outboxForOrder', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b."commandType", b."status") FROM outbox b), '[]'::jsonb),
  'wallet', (SELECT jsonb_build_object('balance', w."balance", 'pending', w."pending", 'lifetimeEarn', w."lifetimeEarn")
    FROM public."LoyaltyWallet" w JOIN target o ON w."userID" = o."userID" AND w."lojaID" = o."lojaID"),
  'walletMovementCount', (SELECT count(*) FROM public."LoyaltyTransaction" t
    JOIN target o ON t."userID" = o."userID" AND t."lojaID" = o."lojaID"),
  'orderLoyaltyMovementCount', (SELECT count(*) FROM public."LoyaltyTransaction" t
    JOIN target o ON t."orderId" = o."id" AND t."lojaID" = o."lojaID"),
  'products', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p."id", 'stock', p."stock",
      'unavailableStock', p."unavailableStock", 'inventoryVersion', p."inventoryVersion") ORDER BY p."id")
    FROM public."Product" p JOIN target o ON p."lojaID" = o."lojaID"
    WHERE EXISTS (SELECT 1 FROM items i WHERE i."productId" = p."id")), '[]'::jsonb),
  'variants', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', v."id", 'productId', v."ProductID",
      'size', v."size", 'color', v."color", 'stock', v."stock", 'unavailableStock', v."unavailableStock",
      'inventoryVersion', v."inventoryVersion") ORDER BY v."id")
    FROM public."ProductVariants" v JOIN public."Product" p ON p."id" = v."ProductID"
    JOIN target o ON p."lojaID" = o."lojaID"
    WHERE EXISTS (SELECT 1 FROM items i WHERE i."productId" = p."id")), '[]'::jsonb),
  'cancellationAudits', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', l."id", 'action', l."action", 'effectKey', l."effectKey",
      'from', l."previousValue" ->> 'status', 'to', l."newValue" ->> 'status',
      'releases', COALESCE((SELECT jsonb_agg(jsonb_build_object('productId', r.value -> 'productId',
        'variantId', r.value -> 'variantId', 'quantity', r.value -> 'quantity', 'destination', r.value -> 'destination'))
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l."metadata" -> 'inventoryReleases') = 'array'
          THEN l."metadata" -> 'inventoryReleases' ELSE '[]'::jsonb END) r), '[]'::jsonb)) ORDER BY l."id")
    FROM public."AuditLog" l JOIN target o ON l."entityId" = o."id"
    WHERE l."entity" = 'Order' AND l."action" = 'ORDER_STATUS_UPDATED'
      AND l."newValue" ->> 'status' = 'CANCELLED'), '[]'::jsonb)
) AS evidence;
