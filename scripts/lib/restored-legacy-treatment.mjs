// Read-only proposal. A unique current variant is not historical stock evidence.
import fs from 'node:fs/promises';
import ts from 'typescript';

export async function classifyUnlinkedItems(items, variants) {
  const source = await fs.readFile(new URL('../../lib/product-variants.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { normalizeVariantDimension } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
  const counts = { missingProduct: 0, noCompatibleVariant: 0, multipleCandidates: 0,
    singleCandidateIncompleteDimensions: 0, singleCandidateWithDimensions: 0 };
  for (const item of items) {
    if (!item.product) { counts.missingProduct++; continue; }
    // Null means missing historical evidence, not a neutral/default choice.
    // Retired/out-of-stock variants are included as historical candidates only;
    // no variant is selected or made available for a purchase by this report.
    const candidates = variants.filter(v => v.product === item.product &&
      (item.size == null || normalizeVariantDimension(v.size) === normalizeVariantDimension(item.size)) &&
      (item.color == null || normalizeVariantDimension(v.color) === normalizeVariantDimension(item.color)));
    if (!candidates.length) counts.noCompatibleVariant++;
    else if (candidates.length > 1) counts.multipleCandidates++;
    else if (item.size == null || item.color == null) counts.singleCandidateIncompleteDimensions++;
    else counts.singleCandidateWithDimensions++;
  }
  return counts;
}

export async function inspectLegacyTreatment(pg) {
  // Caller verifies clone label and executes this only after sanitization.
  const sql = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
    SELECT jsonb_build_object(
      'items',(SELECT COALESCE(jsonb_agg(jsonb_build_object('product',"productId",'size',size,'color',color)),'[]') FROM "OrderItem" WHERE "productVariantsId" IS NULL),
      'variants',(SELECT COALESCE(jsonb_agg(jsonb_build_object('product',"ProductID",'size',size,'color',color)),'[]') FROM "ProductVariants"),
      'inventory',(SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT p.name,p.stock,
        (SELECT sum(v.stock) FROM "ProductVariants" v WHERE v."ProductID"=p.id) AS "variantTotal",
        (SELECT count(*) FROM "OrderItem" i WHERE i."productId"=p.id) AS "orderItemLinks",
        (SELECT count(*) FROM "CartItem" i WHERE i."productID"=p.id) AS "cartItemLinks"
        FROM "Product" p WHERE p.stock<>(SELECT COALESCE(sum(v.stock),0) FROM "ProductVariants" v WHERE v."ProductID"=p.id) ORDER BY p.name) x),
      'wallets',(SELECT COALESCE(jsonb_agg(jsonb_build_object('balance',w.balance,'accountingReady',w."accountingReady",
        'ledgerSum',(SELECT COALESCE(sum(t.points),0) FROM "LoyaltyTransaction" t WHERE t."lojaID"=w."lojaID" AND t."userID"=w."userID"),
        'movements',(SELECT count(*) FROM "LoyaltyTransaction" t WHERE t."lojaID"=w."lojaID" AND t."userID"=w."userID"),
        'lots',(SELECT count(*) FROM "LoyaltyLot" l WHERE l."walletId"=w.id)) ORDER BY w.balance),'[]') FROM "LoyaltyWallet" w)
    ); COMMIT;`;
  const output = await pg.sql(sql);
  const raw = JSON.parse(output.split('\n').find(line => line.trim().startsWith('{')));
  return { schemaVersion: 1, asOf: new Date().toISOString(), readOnly: true,
    unlinkedItems: raw.items.length, variantCandidates: await classifyUnlinkedItems(raw.items, raw.variants),
    inventory: raw.inventory, wallets: raw.wallets, automaticRepairs: [],
    candidateMatchIsHistoricalProof: false, productionReady: false };
}
