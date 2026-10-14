-- Somente leitura no banco efetivo do Preview; nao processa filas.
-- Depois da emissao, preencher order_id e order_number com os valores reais.
-- Nunca usar "ultimo pedido" ou presumir numero #6. Manter loja e metodo fixos.
-- Nao retorna URL/linha digitavel nem dados pessoais. Nao consulta o Asaas.
WITH params AS (
  SELECT ''::text AS order_id, NULL::integer AS order_number
), target AS (
  SELECT o.* FROM public."Order" o CROSS JOIN params p
  WHERE o."id" = p.order_id AND o."orderNumber" = p.order_number
    AND o."lojaID" = '3a82b33c-3646-4272-9a89-80bb1ba327a5'
    AND o."paymentMethod" = 'BOLETO'
), attempts AS (
  SELECT a."id", a."orderId", a."number", a."method", a."status", a."version", a."provider",
    a."providerAccount", a."externalReference", a."financialTotal", a."installments",
    a."failureCode", a."externalExpiresAt", a."reservationExpiresAt", a."reconcileAfter", a."reviewAfter",
    a."planSnapshot" -> 'expiryPolicy' AS "expiryPolicy"
  FROM public."PaymentAttempt" a JOIN target o ON a."orderId" = o."id"
), charges AS (
  SELECT c."id", c."attemptId", c."providerPaymentId", c."providerAccount", c."ordinal", c."amount",
    c."providerStatus", c."settledAt", c."dueAt",
    length(COALESCE(c."instructions" ->> 'bankSlipUrl', '')) > 0 AS "bankSlipUrlPresent",
    length(COALESCE(c."instructions" ->> 'digitableLine', '')) > 0 AS "digitableLinePresent"
  FROM public."PaymentCharge" c JOIN attempts a ON a."id" = c."attemptId"
), wallet AS (
  SELECT w.* FROM public."LoyaltyWallet" w JOIN target o ON w."lojaID" = o."lojaID" AND w."userID" = o."userID"
)
SELECT jsonb_build_object(
  'phase', 'boleto_diagnostic_read', 'at', clock_timestamp(), 'processingAttempted', false,
  'code', CASE WHEN (SELECT order_id = '' OR order_number IS NULL FROM params) THEN 'ORDER_SCOPE_REQUIRED'
    WHEN (SELECT count(*) FROM target) = 1 THEN 'INTERNAL_STATE_READ' ELSE 'ORDER_SCOPE_NOT_FOUND' END,
  'orderCount', (SELECT count(*) FROM target),
  'order', (SELECT jsonb_build_object('id', o."id", 'orderNumber', o."orderNumber", 'status', o."status", 'version', o."version",
    'paymentMethod', o."paymentMethod", 'deliveryType', o."deliveryType", 'total', o."total", 'financialTotal', o."financialTotal",
    'shippingCost', o."shippingCost", 'financingCharge', o."financingCharge", 'installments', o."installments",
    'pointsRedeemed', o."pointsRedeemed", 'pointsCredited', o."pointsCredited", 'paidAt', o."paidAt",
    'asaasPaymentId', o."asaasPaymentId", 'asaasPaymentStatus', o."asaasPaymentStatus", 'asaasDueDate', o."asaasDueDate",
    'bankSlipUrlPresent', length(COALESCE(o."asaasBankSlipUrl", '')) > 0,
    'digitableLinePresent', length(COALESCE(o."asaasDigitableLine", '')) > 0) FROM target o),
  'attempts', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a."number", a."id") FROM attempts a), '[]'::jsonb),
  'charges', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c."ordinal", c."id") FROM charges c), '[]'::jsonb),
  'financialFacts', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', f."id", 'type', f."type", 'amount', f."amount", 'factKey', f."factKey") ORDER BY f."id")
    FROM public."FinancialFact" f JOIN target o ON f."orderId" = o."id"), '[]'::jsonb),
  'operations', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p."id", 'kind', p."kind", 'status', p."status", 'lastErrorCode', p."lastErrorCode") ORDER BY p."id")
    FROM public."PaymentOperation" p JOIN attempts a ON p."attemptId" = a."id"), '[]'::jsonb),
  'wallet', (SELECT jsonb_build_object('balance', w."balance", 'pending', w."pending", 'debt', w."debt", 'lifetimeEarn', w."lifetimeEarn") FROM wallet w),
  'lotRemainingSum', (SELECT COALESCE(sum(l."remaining"), 0) FROM public."LoyaltyLot" l JOIN wallet w ON l."walletId" = w."id"),
  'loyaltyMovements', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', l."id", 'type', l."type", 'points', l."points", 'balanceAfter', l."balanceAfter", 'effectKey', l."effectKey") ORDER BY l."createdAt", l."id")
    FROM public."LoyaltyTransaction" l JOIN target o ON l."orderId" = o."id" AND l."lojaID" = o."lojaID"), '[]'::jsonb),
  'itemsAndStock', COALESCE((SELECT jsonb_agg(jsonb_build_object('itemId', i."id", 'productId', i."productId", 'variantId', i."productVariantsId", 'quantity', i."quantity",
    'productStock', p."stock", 'variantStock', v."stock", 'productInventoryVersion', p."inventoryVersion", 'variantInventoryVersion', v."inventoryVersion",
    'reservationId', r."id", 'reservationStatus', r."status", 'reservationQuantity', r."quantity",
    'reservationMatchesItem', COALESCE(r."productId" = i."productId" AND r."variantId" = i."productVariantsId" AND r."quantity" = i."quantity", false)) ORDER BY i."id")
    FROM public."OrderItem" i JOIN target o ON i."orderId" = o."id"
    LEFT JOIN public."Product" p ON p."id" = i."productId" AND p."lojaID" = o."lojaID"
    LEFT JOIN public."ProductVariants" v ON v."id" = i."productVariantsId" AND v."ProductID" = p."id"
    LEFT JOIN public."InventoryReservation" r ON r."orderItemId" = i."id" AND r."orderId" = o."id"), '[]'::jsonb),
  'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', h."status", 'previousStatus', h."previousStatus", 'orderVersion', h."orderVersion") ORDER BY h."createdAt", h."id")
    FROM public."OrderStatusHistory" h JOIN target o ON h."orderId" = o."id"), '[]'::jsonb),
  'inbox', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', b."id", 'eventType', b."eventType", 'status', b."status", 'attempts', b."attempts", 'lastErrorCode', b."lastErrorCode") ORDER BY b."receivedAt", b."id")
    FROM public."PaymentInbox" b WHERE b."provider" = 'ASAAS:sandbox-hml'
    AND (EXISTS (SELECT 1 FROM attempts a WHERE b."payload" -> 'payment' ->> 'externalReference' = a."externalReference")
      OR EXISTS (SELECT 1 FROM charges c WHERE b."payload" -> 'payment' ->> 'id' = c."providerPaymentId"))), '[]'::jsonb),
  'outbox', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', b."id", 'commandType', b."commandType", 'status', b."status", 'attempts', b."attempts", 'lastErrorCode', b."lastErrorCode") ORDER BY b."id")
    FROM public."CommerceOutbox" b JOIN target o ON b."aggregateId" = o."id"), '[]'::jsonb)
) AS evidence;
