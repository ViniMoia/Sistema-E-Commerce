// WF-18. Read-only inventory; no recommendation here is permission to mutate.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
let combination;
async function variantCombination() {
  if (!combination) {
    // Reuse the domain's pure TS helper without creating compilation artifacts.
    const source = await fs.readFile(new URL('../../lib/product-variants.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    combination = (await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))).getVariantCombinationKey;
  }
  return combination;
}
export const LEGACY_AUDIT_SQL = `
WITH tenant AS (
  SELECT l.id,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id) AS orders,
    (SELECT count(*) FROM "OrderItem" i JOIN "Order" o ON o.id=i."orderId" WHERE o."lojaID"=l.id AND i."productVariantsId" IS NULL) AS missing_variant_links,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id AND o."checkoutIntentID" IS NULL) AS legacy_orders,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id AND o."idempotencyKey" IS NULL AND o."checkoutIntentID" IS NULL) AS legacy_unkeyed_orders,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id AND o."checkoutIntentID" IS NULL AND o.status='PENDING') AS legacy_open_orders,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id AND o."asaasPaymentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "PaymentAttempt" a WHERE a."orderId"=o.id)) AS untracked_remote_orders,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id AND o.status IN ('PAID','SHIPPED','DELIVERED') AND NOT EXISTS (SELECT 1 FROM "FinancialFact" f WHERE f."orderId"=o.id AND f.type IN ('AUTHORIZED','SETTLED'))) AS paid_without_facts,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id AND o."checkoutIntentID" IS NULL AND NOT EXISTS (SELECT 1 FROM "InventoryReservation" r WHERE r."orderId"=o.id)) AS legacy_without_reservation,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id AND o."buyerID" IS NULL) AS missing_buyer_snapshot,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id AND o."deliveryType"='DELIVERY' AND o."freightSnapshot" IS NULL) AS delivery_without_quote_snapshot,
    (SELECT count(*) FROM "FreightRule" f WHERE f."lojaID"=l.id AND (f.state IS NULL OR f."municipalityCode" IS NULL)) AS freight_without_geography,
    (SELECT count(*) FROM "LoyaltyWallet" w WHERE w."lojaID"=l.id AND NOT w."accountingReady") AS unreconciled_wallets,
    (SELECT count(*) FROM "LoyaltyTransaction" t WHERE t."lojaID"=l.id AND (t."effectKey" IS NULL OR t."availableDelta" IS NULL)) AS legacy_loyalty_movements,
    (SELECT count(*) FROM "User" u WHERE u."lojaID"=l.id AND u."resetToken" IS NOT NULL AND u."resetTokenExpires">transaction_timestamp() AND u."resetToken" !~ '^[a-f0-9]{64}$') AS active_legacy_reset_tokens,
    (SELECT count(*) FROM "Product" p WHERE p."lojaID"=l.id AND p."retiredAt" IS NULL AND NOT EXISTS (SELECT 1 FROM "ProductVariants" v WHERE v."ProductID"=p.id AND v."retiredAt" IS NULL)) AS active_products_without_active_variant,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id AND NOT EXISTS (SELECT 1 FROM "OrderStatusHistory" h WHERE h."orderId"=o.id)) AS orders_without_history,
    (SELECT count(*) FROM "Order" o LEFT JOIN "User" u ON u.id=o."userID" LEFT JOIN "OrderBuyer" b ON b.id=o."buyerID" LEFT JOIN "Address" a ON a.id=o."addressID"
      WHERE o."lojaID"=l.id AND ((o."userID" IS NOT NULL AND (u.id IS NULL OR u."lojaID"<>o."lojaID")) OR
        (o."buyerID" IS NOT NULL AND (b.id IS NULL OR b."lojaID"<>o."lojaID")) OR
        (o."addressID" IS NOT NULL AND (a.id IS NULL OR a."userID" IS DISTINCT FROM o."userID")))) AS invalid_order_ownership,
    (SELECT count(*) FROM "OrderItem" i JOIN "Order" o ON o.id=i."orderId" LEFT JOIN "Product" p ON p.id=i."productId" LEFT JOIN "ProductVariants" v ON v.id=i."productVariantsId"
      WHERE o."lojaID"=l.id AND ((i."productId" IS NOT NULL AND (p.id IS NULL OR p."lojaID"<>o."lojaID")) OR
        (i."productVariantsId" IS NOT NULL AND (v.id IS NULL OR v."ProductID" IS DISTINCT FROM i."productId")))) AS invalid_item_ownership,
    (SELECT count(*) FROM "Cart" c JOIN "User" u ON u.id=c."userID" WHERE c."lojaID"=l.id AND c."lojaID"<>u."lojaID") AS invalid_cart_ownership,
    (SELECT count(*) FROM "CartItem" i JOIN "Cart" c ON c.id=i."cartID" JOIN "Product" p ON p.id=i."productID" JOIN "ProductVariants" v ON v.id=i."variantID"
      WHERE c."lojaID"=l.id AND (i."lojaID"<>c."lojaID" OR p."lojaID"<>c."lojaID" OR v."ProductID"<>p.id)) AS invalid_cart_item_ownership,
    (SELECT count(*) FROM (SELECT c."userID" FROM "Cart" c WHERE c."lojaID"=l.id AND c.status='ACTIVE' GROUP BY c."userID" HAVING count(*)>1) d) AS duplicate_active_cart_owners,
    (SELECT count(*) FROM "LoyaltyWallet" w WHERE w."lojaID"=l.id AND w."accountingReady" AND
      (w.balance<0 OR w.debt<0 OR (w.balance>0 AND w.debt>0) OR w.balance<>(SELECT COALESCE(sum(r.remaining),0) FROM "LoyaltyLot" r WHERE r."walletId"=w.id))) AS divergent_ready_wallets,
    (SELECT count(*) FROM "FinancialFact" f JOIN "Order" o ON o.id=f."orderId" LEFT JOIN "PaymentAttempt" a ON a.id=f."attemptId" LEFT JOIN "PaymentCharge" c ON c.id=f."chargeId"
      WHERE o."lojaID"=l.id AND (a.id IS NULL OR a."orderId"<>f."orderId" OR a.provider<>f.provider OR a."providerAccount" IS DISTINCT FROM f."providerAccount" OR
        (f."chargeId" IS NOT NULL AND (c.id IS NULL OR c."attemptId"<>a.id OR c.provider<>f.provider OR c."providerAccount" IS DISTINCT FROM f."providerAccount" OR c.amount<>f.amount)))) AS invalid_financial_provenance,
    (SELECT count(*) FROM "InventoryReservation" r JOIN "Order" o ON o.id=r."orderId" JOIN "OrderItem" i ON i.id=r."orderItemId" JOIN "Product" p ON p.id=r."productId" JOIN "ProductVariants" v ON v.id=r."variantId"
      WHERE o."lojaID"=l.id AND (i."orderId"<>r."orderId" OR i."productId" IS DISTINCT FROM r."productId" OR i."productVariantsId" IS DISTINCT FROM r."variantId"
        OR p."lojaID"<>o."lojaID" OR v."ProductID"<>p.id OR i.quantity<>r.quantity)) AS invalid_reservation_provenance,
    (SELECT count(*) FROM "LoyaltyTransaction" t JOIN "User" u ON u.id=t."userID" LEFT JOIN "Order" o ON o.id=t."orderId"
      WHERE t."lojaID"=l.id AND (u."lojaID"<>t."lojaID" OR (t."orderId" IS NOT NULL AND (o."lojaID"<>t."lojaID" OR o."userID" IS DISTINCT FROM t."userID")))) AS invalid_loyalty_ownership,
    (SELECT count(*) FROM "Order" o WHERE o."lojaID"=l.id AND o."checkoutIntentID" IS NOT NULL AND
      (o."financialPlan" IS NULL OR o."financialTotal" IS NULL OR NOT EXISTS (SELECT 1 FROM "PaymentAttempt" a WHERE a."orderId"=o.id) OR
      (SELECT count(*) FROM "InventoryReservation" r WHERE r."orderId"=o.id)<>(SELECT count(*) FROM "OrderItem" i WHERE i."orderId"=o.id))) AS incomplete_protocol_orders
  FROM "Loja" l
)
SELECT jsonb_build_object(
  'asOf',transaction_timestamp(),
  'tenants',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM tenant t),'[]'::jsonb),
  'variants',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'productId',v."ProductID",'lojaID',p."lojaID",'size',v.size,'color',v.color,
    'retired',v."retiredAt" IS NOT NULL,'stock',v.stock,'unavailableStock',v."unavailableStock",
    'cartLinks',(SELECT count(*) FROM "CartItem" c WHERE c."variantID"=v.id),
    'orderLinks',(SELECT count(*) FROM "OrderItem" i WHERE i."productVariantsId"=v.id),
    'reservationLinks',(SELECT count(*) FROM "InventoryReservation" r WHERE r."variantId"=v.id)
  ) ORDER BY v.id) FROM "ProductVariants" v JOIN "Product" p ON p.id=v."ProductID"),'[]'::jsonb),
  'contract',jsonb_build_object(
    'unvalidatedConstraints',(SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated),
    'invalidIndexes',(SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (NOT i.indisvalid OR NOT i.indisready)),
    'disabledTriggers',(SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled<>'O'),
    'missingGuards',(SELECT COALESCE(jsonb_agg(name),'[]'::jsonb) FROM (VALUES ('checkout_commit_complete'),('checkout_intent_immutable'),('checkout_cart_consumed'),
      ('checkout_basket_consumed'),('inventory_reservation_source'),('FinancialFact_provenance'),('PaymentOperation_provenance')) required(name)
      WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND t.tgname=name AND t.tgenabled='O'))
  )
) AS report;`;

const blockers = ['invalid_order_ownership','invalid_item_ownership','invalid_cart_ownership','invalid_cart_item_ownership',
  'duplicate_active_cart_owners','divergent_ready_wallets','incomplete_protocol_orders','invalid_financial_provenance','invalid_reservation_provenance','invalid_loyalty_ownership'];
/** Raw IDs/dimensions never leave this reducer. Tags are only for locating a
 * record during private reconciliation, never authorization or repair evidence. */
export async function classifyLegacyAudit(raw, salt) {
  if (!salt) throw new Error('LEGACY_AUDIT_IDENTITY_REQUIRED');
  const tag = value => createHash('sha256').update(salt + ':' + value).digest('hex').slice(0,24);
  const key = await variantCombination();
  const groups = new Map();
  for (const variant of raw.variants) {
    // Retired rows retain historical identity; only available catalogue rows
    // compete for the same selection. No primary/duplicate winner is guessed.
    if (variant.retired) continue;
    const groupKey = variant.productId + ':' + key(variant);
    const group = groups.get(groupKey) ?? []; group.push(variant); groups.set(groupKey,group);
  }
  const duplicateGroups = [...groups.values()].filter(group => group.length>1).map(group => ({
    tenantTag:tag(group[0].lojaID),productTag:tag(group[0].productId),variantTags:group.map(v=>tag(v.id)),
    cartLinks:group.reduce((n,v)=>n+v.cartLinks,0),orderLinks:group.reduce((n,v)=>n+v.orderLinks,0),
    reservationLinks:group.reduce((n,v)=>n+v.reservationLinks,0), resolution:'REVIEW_INVENTORY_AND_LINKS_NO_MERGE',
  }));
  const tenants = raw.tenants.map(({ id,...counts }) => ({
    tenantTag:tag(id),counts,
    integrityBlockers:blockers.reduce((n,name)=>n+counts[name],0),
    reviewReasons:Object.entries(counts).filter(([name,value])=>name!=='orders'&&!blockers.includes(name)&&value>0).map(([name])=>name),
  }));
  if (tenants.some(t=>Object.values(t.counts).some(value=>!Number.isSafeInteger(value)||value<0))) throw new Error('LEGACY_AUDIT_COUNT_INVALID');
  const contract = raw.contract;
  const integrityPassed = tenants.every(t=>t.integrityBlockers===0) && contract.unvalidatedConstraints===0 &&
    contract.invalidIndexes===0 && contract.disabledTriggers===0 && contract.missingGuards.length===0;
  return { schemaVersion:1,policy:'LEGACY_COMMERCE_RECONCILIATION_V1',asOf:raw.asOf,tenants,duplicateGroups,contract,
    integrityPassed, requiresReconciliation:duplicateGroups.length>0||tenants.some(t=>t.reviewReasons.length>0),
    automaticRepairs:[],productionReady:false,
    decisions:{ nullableHistoricalLinks:'KEEP_UNTIL_PROVEN',financialLegacy:'NO_INFERRED_FACTS',loyaltyLegacy:'KEEP_ACCOUNTING_BLOCKED',
      variantDuplicates:'NO_SUM_NO_DELETE_NO_RETIRE_WITHOUT_EVIDENCE',unkeyedLegacy:'NO_FABRICATED_IDEMPOTENCY_KEYS' } };
}
