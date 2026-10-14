-- Executar no SQL Editor do banco/branch efetivos do Preview de homologacao.
-- Somente leitura: nao altera configuracao, tarifas, estoque ou pedidos.
-- Nao retorna senhas/tokens. Nao consulta Correios nem comprova disponibilidade remota.
-- CEP de destino informado no ensaio. Regras PA sao candidatas para inspecao;
-- o consumidor exige UF, IBGE e nome normalizado iguais ao destino resolvido.
WITH target AS (
  SELECT l."id", l."slug", l."originCep", l."enableCorreios", l."additionalDays",
    length(COALESCE(l."correiosContractCode", '')) > 0 AS "correiosContractPresent",
    length(COALESCE(l."correiosPassword", '')) > 0 AS "correiosPasswordPresent",
    regexp_replace(COALESCE(l."originCep", ''), '[^0-9]', '', 'g') = '67140615'
      AS "originMatchesInstalledJtMatrix"
  FROM public."Loja" l
  WHERE l."id" = '3a82b33c-3646-4272-9a89-80bb1ba327a5'
), local_rules AS (
  SELECT r."id", r."cityName", r."state", r."municipalityCode", r."value"
  FROM public."FreightRule" r JOIN target t ON t."id" = r."lojaID"
  WHERE r."state" = 'PA' OR r."state" IS NULL
    OR lower(btrim(r."cityName")) = 'ananindeua'
), jt_destination AS (
  SELECT g."id", g."geocomCode", g."state", g."cepStart", g."cepEnd", g."deliveryDays",
    (SELECT count(*) FROM public."JtExpressRate" r WHERE r."geocom" = g."geocomCode")
      AS "rateCountForGeocom"
  FROM public."JtExpressGeocom" g
  WHERE g."cepStart" <= '67140180' AND g."cepEnd" >= '67140180'
    AND EXISTS (SELECT 1 FROM target)
)
SELECT jsonb_build_object(
  'phase', 'freight_configuration_diagnostic_read',
  'code', CASE WHEN (SELECT count(*) FROM target) = 1
    THEN 'INTERNAL_STATE_READ' ELSE 'STORE_SCOPE_UNEXPECTED' END,
  'at', clock_timestamp(),
  'processingAttempted', false,
  'destinationCep', '67140180',
  'storeCount', (SELECT count(*) FROM target),
  'store', (SELECT to_jsonb(t) FROM target t),
  'localRuleCount', (SELECT count(*) FROM public."FreightRule" r JOIN target t ON t."id" = r."lojaID"),
  'localRulesToInspect', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r."id") FROM local_rules r), '[]'::jsonb),
  'jtRateCount', (SELECT count(*) FROM public."JtExpressRate" WHERE EXISTS (SELECT 1 FROM target)),
  'jtDestinationRanges', COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g."id") FROM jt_destination g), '[]'::jsonb)
) AS evidence;
