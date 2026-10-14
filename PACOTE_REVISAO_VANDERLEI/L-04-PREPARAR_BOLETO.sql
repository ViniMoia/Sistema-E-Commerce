-- Somente leitura no banco/branch efetivos do Preview de homologacao.
-- Nao emite boleto, nao processa filas nem modifica pedidos/estoque/pontos.
-- IDs podem existir em clones; conferir o ambiente antes de executar.
-- Cliente localizado pelo pedido #5, sem expor identidade pessoal.
-- Defaults de ambiente e disponibilidade Asaas nao sao comprovados pelo SQL.
WITH observed AS MATERIALIZED (
  SELECT clock_timestamp() AS now
), store AS (
  SELECT "id", "slug", "configurationVersion", "enableBoleto", "enablePickup",
    "loyaltyEnabled", "loyaltyEarnRate", "loyaltyPointValue", "loyaltyMinPointsRedeem"
  FROM public."Loja"
  WHERE "id" = '3a82b33c-3646-4272-9a89-80bb1ba327a5' AND "slug" = 'continental-homologacao'
), reference_order AS (
  SELECT o."id", o."lojaID", o."userID", o."status", o."version"
  FROM public."Order" o JOIN store s ON s."id" = o."lojaID"
  WHERE o."id" = 'bb3f722b-8392-4a23-863b-d2d428444faa' AND o."orderNumber" = 5
), wallet AS (
  SELECT w.* FROM public."LoyaltyWallet" w JOIN reference_order o
    ON w."lojaID" = o."lojaID" AND w."userID" = o."userID"
), product AS (
  SELECT p."id", p."price", p."stock", p."unavailableStock", p."inventoryVersion", p."stockBuffer"
  FROM public."Product" p JOIN store s ON p."lojaID" = s."id"
  WHERE p."id" = 'a26fdbc1-d8c3-4173-b114-f759654b9ca4'
), variant AS (
  SELECT v."id", v."size", v."color", v."stock", v."unavailableStock", v."inventoryVersion", v."retiredAt"
  FROM public."ProductVariants" v JOIN product p ON v."ProductID" = p."id"
  WHERE v."id" = 'c9422a68-9be8-4fdc-bc5f-5ee7689401d2'
), existing_boleto AS (
  SELECT o."id", o."orderNumber", o."status", o."version", o."total", o."financialTotal",
    o."asaasPaymentStatus", o."asaasDueDate", o."createdAt",
    o."asaasPaymentId" IS NOT NULL AS "providerPaymentIdPresent",
    length(COALESCE(o."asaasBankSlipUrl", '')) > 0 AS "bankSlipUrlPresent",
    length(COALESCE(o."asaasDigitableLine", '')) > 0 AS "digitableLinePresent"
  FROM public."Order" o JOIN reference_order r ON o."lojaID" = r."lojaID" AND o."userID" = r."userID"
  WHERE o."paymentMethod" = 'BOLETO'
)
SELECT jsonb_build_object(
  'phase', 'boleto_baseline_read', 'at', (SELECT now FROM observed),
  'code', CASE WHEN (SELECT count(*) FROM reference_order) = 1 AND (SELECT count(*) FROM wallet) = 1
    AND (SELECT count(*) FROM variant) = 1 THEN 'BASELINE_READ' ELSE 'BASELINE_SCOPE_UNEXPECTED' END,
  'processingAttempted', false, 'expectedAccountScope', 'sandbox-hml',
  'proposedScenario', jsonb_build_object('method', 'BOLETO', 'deliveryType', 'PICKUP', 'quantity', 1, 'pointsToRedeem', 0),
  'store', (SELECT to_jsonb(s) FROM store s),
  'referenceOrder', (SELECT to_jsonb(o) - 'userID' FROM reference_order o),
  'product', (SELECT to_jsonb(p) FROM product p), 'variant', (SELECT to_jsonb(v) FROM variant v),
  'wallet', (SELECT jsonb_build_object('balance', w."balance", 'pending', w."pending", 'debt', w."debt",
    'lifetimeEarn', w."lifetimeEarn", 'accountingReady', w."accountingReady", 'version', w."version") FROM wallet w),
  'lotRemainingSum', (SELECT COALESCE(sum(l."remaining"), 0) FROM public."LoyaltyLot" l JOIN wallet w ON l."walletId" = w."id"),
  'expiredPositiveLotCount', (SELECT count(*) FROM public."LoyaltyLot" l JOIN wallet w ON l."walletId" = w."id"
    CROSS JOIN observed t WHERE l."remaining" > 0 AND l."expiresAt" <= t.now),
  'existingBoletoOrders', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b."createdAt", b."id") FROM existing_boleto b), '[]'::jsonb),
  'observedAttemptAccounts', COALESCE((SELECT jsonb_agg(DISTINCT a."providerAccount") FROM public."PaymentAttempt" a
    JOIN public."Order" o ON o."id" = a."orderId" JOIN store s ON s."id" = o."lojaID"), '[]'::jsonb)
) AS evidence;
