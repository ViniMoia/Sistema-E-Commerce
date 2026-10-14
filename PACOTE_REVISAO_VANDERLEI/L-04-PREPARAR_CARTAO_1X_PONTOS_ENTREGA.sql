-- Executar no banco/branch efetivos do Preview homologacao_teste.
-- Somente leitura: nao compra, reserva, resgata, expira pontos ou processa filas.
-- Cliente localizado pelo pedido #4; nao divulga nome, email ou endereco.
-- Identidades podem existir em clones: confirmar o ambiente no SQL Editor.
-- Esta leitura nao substitui a proposta do checkout nem valida saldo remoto Asaas.
WITH observed AS MATERIALIZED (
  SELECT clock_timestamp() AS now
), reference_order AS (
  SELECT o."id", o."lojaID", o."userID"
  FROM public."Order" o
  WHERE o."id" = 'ae14cb17-49fa-47ae-98eb-b48ef3f8ada1'
    AND o."lojaID" = '3a82b33c-3646-4272-9a89-80bb1ba327a5' AND o."orderNumber" = 4
), wallet AS (
  SELECT w.* FROM public."LoyaltyWallet" w JOIN reference_order o
    ON w."lojaID" = o."lojaID" AND w."userID" = o."userID"
), product AS (
  SELECT p."id", p."price", p."stock", p."unavailableStock", p."inventoryVersion"
  FROM public."Product" p JOIN reference_order o ON p."lojaID" = o."lojaID"
  WHERE p."id" = 'a26fdbc1-d8c3-4173-b114-f759654b9ca4'
), variant AS (
  SELECT v."id", v."size", v."color", v."stock", v."unavailableStock", v."inventoryVersion", v."retiredAt"
  FROM public."ProductVariants" v JOIN product p ON v."ProductID" = p."id"
  WHERE v."id" = 'c9422a68-9be8-4fdc-bc5f-5ee7689401d2'
)
SELECT jsonb_build_object(
  'phase', 'card_1x_points_delivery_baseline',
  'code', CASE WHEN (SELECT count(*) FROM reference_order) = 1
    AND (SELECT count(*) FROM wallet) = 1 AND (SELECT count(*) FROM variant) = 1
    THEN 'BASELINE_READ' ELSE 'BASELINE_SCOPE_UNEXPECTED' END,
  'at', (SELECT now FROM observed), 'processingAttempted', false,
  'expectedAccountScope', 'sandbox-hml',
  'referenceOrderId', 'ae14cb17-49fa-47ae-98eb-b48ef3f8ada1',
  'proposedQuantity', 1, 'proposedPointsToRedeem', 100,
  'policy', (SELECT jsonb_build_object('configurationVersion', l."configurationVersion",
    'enabled', l."loyaltyEnabled", 'earnRate', l."loyaltyEarnRate", 'pointValue', l."loyaltyPointValue",
    'minPointsRedeem', l."loyaltyMinPointsRedeem", 'maxDiscountPct', l."loyaltyMaxDiscountPct",
    'pointsExpiryDays', l."loyaltyPointsExpiryDays")
    FROM public."Loja" l JOIN reference_order o ON l."id" = o."lojaID"),
  'wallet', (SELECT jsonb_build_object('balance', w."balance", 'pending', w."pending",
    'lifetimeEarn', w."lifetimeEarn", 'debt', w."debt", 'accountingReady', w."accountingReady",
    'version', w."version") FROM wallet w),
  'lots', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', l."id", 'remaining', l."remaining",
    'expiresAt', l."expiresAt", 'unexpiredAtRead', l."expiresAt" IS NULL OR l."expiresAt" > t.now)
    ORDER BY l."expiresAt" NULLS LAST, l."createdAt", l."id")
    FROM public."LoyaltyLot" l JOIN wallet w ON l."walletId" = w."id" CROSS JOIN observed t
    WHERE l."remaining" > 0), '[]'::jsonb),
  'product', (SELECT to_jsonb(p) FROM product p),
  'variant', (SELECT to_jsonb(v) FROM variant v)
) AS evidence;
