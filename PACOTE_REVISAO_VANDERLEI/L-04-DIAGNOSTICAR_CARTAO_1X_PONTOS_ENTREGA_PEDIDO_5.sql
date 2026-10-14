-- Executar no SQL Editor do banco/branch efetivos do Preview de homologacao.
-- Somente leitura. Nao processa filas, nao cobra e nao altera reconciliacao.
-- Confirme o ambiente: IDs e numeros de pedidos podem existir em clones.
-- Identidade do pedido #5 confirmada pela leitura de 14/10/2026 13:46 UTC.
-- INTERNAL_STATE_READ nao significa pagamento aprovado nem ambiente validado.
WITH observed AS MATERIALIZED (
  SELECT clock_timestamp() AS now
), target AS (
  SELECT o."id", o."orderNumber", o."lojaID", o."userID", o."version", o."status",
         o."paymentMethod", o."deliveryType", o."total", o."financialTotal",
         o."financingCharge", o."installments", o."installmentValue",
         o."asaasPaymentId", o."asaasPaymentStatus", o."paidAt",
         o."pointsRedeemed", o."pointsCredited", o."subtotal", o."pointsDiscountValue",
         o."shippingCost", o."shippingProvider", o."shippingServiceName", o."shippingEstimatedDays", o."freightQuoteId"
  FROM public."Order" o
  WHERE o."lojaID" = '3a82b33c-3646-4272-9a89-80bb1ba327a5'
    AND o."orderNumber" = 5
    AND o."id" = 'bb3f722b-8392-4a23-863b-d2d428444faa'
), attempts AS (
  SELECT a."id", a."orderId", a."number", a."provider", a."providerAccount",
         a."method", a."status", a."version", a."externalReference",
         a."providerContractId", a."financialTotal", a."installments",
         a."failureCode", a."reconcileAfter", a."reviewAfter", a."reconcileAttempts",
         a."leaseExpiresAt", a."createdAt", a."updatedAt",
         a."providerAccount" = 'sandbox-hml' AS "expectedAccountMatches",
         (a."provider" = 'ASAAS' AND a."status" IN ('SUBMITTING', 'UNKNOWN')) AS "countedAsUncertain",
         (a."provider" = 'ASAAS' AND a."reviewAfter" <= t.now
           AND a."status" IN ('SUBMITTING', 'UNKNOWN', 'CANCEL_PENDING', 'REFUND_PENDING')) AS "countedAsOverdue"
  FROM public."PaymentAttempt" a JOIN target o ON a."orderId" = o."id"
  CROSS JOIN observed t
), charges AS (
  SELECT c."id", c."attemptId", c."provider", c."providerAccount", c."providerPaymentId",
         c."ordinal", c."amount", c."providerStatus", c."settledAt"
  FROM public."PaymentCharge" c JOIN attempts a ON c."attemptId" = a."id"
), inbox AS (
  SELECT b."id", b."provider", b."eventType", b."status", b."attempts",
         b."receivedAt", b."completedAt", b."nextAttemptAt", b."lastErrorCode",
         b."payload" -> 'payment' ->> 'id' AS "providerPaymentId",
         b."payload" -> 'payment' ->> 'status' AS "eventPaymentStatus"
  FROM public."PaymentInbox" b
  WHERE b."provider" = 'ASAAS:sandbox-hml'
    AND (EXISTS (SELECT 1 FROM target o WHERE b."payload" -> 'payment' ->> 'externalReference' = o."id"
                  OR b."payload" -> 'payment' ->> 'id' = o."asaasPaymentId")
      OR EXISTS (SELECT 1 FROM attempts a WHERE b."payload" -> 'payment' ->> 'externalReference' = a."externalReference")
      OR EXISTS (SELECT 1 FROM charges c WHERE b."payload" -> 'payment' ->> 'id' = c."providerPaymentId"))
), outbox AS (
  SELECT b."id", b."commandType", b."status", b."attempts", b."lastErrorCode"
  FROM public."CommerceOutbox" b JOIN target o ON b."aggregateId" = o."id"
), facts AS (
  SELECT f."id", f."attemptId", f."chargeId", f."providerAccount", f."type", f."amount", f."factKey"
  FROM public."FinancialFact" f JOIN target o ON f."orderId" = o."id"
)
SELECT jsonb_build_object(
  'phase', 'card_order_5_diagnostic_read',
  'code', CASE WHEN (SELECT count(*) FROM target) = 1 THEN 'INTERNAL_STATE_READ' ELSE 'ORDER_SCOPE_UNEXPECTED' END,
  'at', (SELECT now FROM observed),
  'processingAttempted', false,
  'expectedAccountScope', 'sandbox-hml',
  'orderCount', (SELECT count(*) FROM target),
  'orders', COALESCE((SELECT jsonb_agg(to_jsonb(o) - 'userID' ORDER BY o."id") FROM target o), '[]'::jsonb),
  'attempts', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a."number", a."id") FROM attempts a), '[]'::jsonb),
  'charges', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c."ordinal", c."id") FROM charges c), '[]'::jsonb),
  'chargeCount', (SELECT count(*) FROM charges),
  'chargeAmountSum', (SELECT COALESCE(sum(c."amount"), 0) FROM charges c),
  'inboxForPayment', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b."receivedAt", b."id") FROM inbox b), '[]'::jsonb),
  'outboxForOrder', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b."id") FROM outbox b), '[]'::jsonb),
  'financialFacts', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f."id") FROM facts f), '[]'::jsonb),
  'wallet', (SELECT jsonb_build_object('balance', w."balance", 'pending', w."pending", 'lifetimeEarn', w."lifetimeEarn", 'debt', w."debt", 'accountingReady', w."accountingReady")
    FROM public."LoyaltyWallet" w JOIN target o ON w."userID" = o."userID" AND w."lojaID" = o."lojaID"),
  'orderLoyaltyMovements', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', l."id", 'type', l."type", 'points', l."points", 'balanceAfter', l."balanceAfter", 'effectKey', l."effectKey") ORDER BY l."createdAt", l."id")
    FROM public."LoyaltyTransaction" l JOIN target o ON l."orderId" = o."id" AND l."lojaID" = o."lojaID"), '[]'::jsonb),
  'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', h."id", 'status', h."status",
    'previousStatus', h."previousStatus", 'orderVersion', h."orderVersion") ORDER BY h."createdAt", h."id")
    FROM public."OrderStatusHistory" h JOIN target o ON h."orderId" = o."id"), '[]'::jsonb),
  'loyaltyAllocations', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', a."id", 'transactionId', a."transactionId", 'lotId', a."lotId", 'points', a."points") ORDER BY a."id")
    FROM public."LoyaltyAllocation" a JOIN public."LoyaltyTransaction" l ON l."id" = a."transactionId"
    JOIN target o ON l."orderId" = o."id" AND l."lojaID" = o."lojaID"), '[]'::jsonb),
  'earnedLots', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', b."id", 'credited', b."credited",
    'remaining', b."remaining", 'sourceTransactionId', b."sourceTransactionId", 'sourceKey', b."sourceKey") ORDER BY b."id")
    FROM public."LoyaltyLot" b JOIN public."LoyaltyTransaction" l ON l."id" = b."sourceTransactionId"
    JOIN target o ON l."orderId" = o."id" AND l."lojaID" = o."lojaID"), '[]'::jsonb),
  'walletLotRemaining', (SELECT COALESCE(sum(b."remaining"), 0) FROM public."LoyaltyLot" b
    JOIN public."LoyaltyWallet" w ON w."id" = b."walletId"
    JOIN target o ON w."userID" = o."userID" AND w."lojaID" = o."lojaID"),
  'freightQuote', (SELECT jsonb_build_object('id', q."id", 'provider', q."provider", 'serviceCode', q."serviceCode",
    'amount', q."amount", 'estimatedDays', q."estimatedDays",
    'matchesOrder', q."amount" = o."shippingCost" AND q."provider" = o."shippingProvider"
      AND q."estimatedDays" = o."shippingEstimatedDays" AND q."deliveryType" = o."deliveryType")
    FROM public."FreightQuote" q JOIN target o ON q."id" = o."freightQuoteId" AND q."lojaID" = o."lojaID"),
  'itemsAndStock', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'itemId', i."id", 'productId', i."productId", 'variantId', i."productVariantsId",
    'size', i."size", 'color', i."color", 'quantity', i."quantity",
    'productStock', p."stock", 'productUnavailableStock', p."unavailableStock", 'productInventoryVersion', p."inventoryVersion",
    'variantStock', v."stock", 'variantUnavailableStock', v."unavailableStock", 'variantInventoryVersion', v."inventoryVersion",
    'reservationId', r."id", 'reservationStatus', r."status", 'reservationQuantity', r."quantity",
    'reservationMatchesItem', COALESCE(r."productId" = i."productId" AND r."variantId" = i."productVariantsId" AND r."quantity" = i."quantity", false)) ORDER BY i."id")
    FROM public."OrderItem" i JOIN target o ON i."orderId" = o."id"
    LEFT JOIN public."Product" p ON p."id" = i."productId" AND p."lojaID" = o."lojaID"
    LEFT JOIN public."ProductVariants" v ON v."id" = i."productVariantsId" AND v."ProductID" = p."id"
    LEFT JOIN public."InventoryReservation" r ON r."orderItemId" = i."id" AND r."orderId" = o."id"), '[]'::jsonb)
) AS evidence;
