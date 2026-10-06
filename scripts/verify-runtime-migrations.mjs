import { command, provisionPostgres } from './lib/disposable-postgres.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

async function assertSchema(pg) {
  const durable = await pg.sql(`SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND tgname IN ('PaymentOperation_provenance','FinancialFact_provenance');
    SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN ('PaymentAttempt_lease_pair','PaymentAttempt_reconcile_nonnegative','PaymentOperation_kind_check','PaymentOperation_status_check');`);
  if (!durable.split('\n').some(line => line.trim()==='2') || !durable.split('\n').some(line => line.trim()==='4')) throw new Error('Executor financeiro/procedência SQL ausentes.');
  const checkout = await pg.sql(`SELECT count(*) FROM pg_constraint WHERE conname='chk_checkout_intent_source' AND convalidated;
    SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND tgname IN
    ('inventory_reservation_source','checkout_commit_complete','checkout_intent_immutable','checkout_cart_consumed','checkout_basket_consumed');`);
  if (!checkout.split('\n').some(line => line.trim()==='1') || !checkout.split('\n').some(line => line.trim()==='5')) throw new Error('Protocolo SQL de checkout ausente.');
  const basket = await pg.sql(`SELECT pg_get_indexdef(indexrelid) FROM pg_index WHERE indexrelid='"CheckoutBasket_active_owner_key"'::regclass;`);
  if (!basket.includes('UNIQUE') || !basket.includes('ACTIVE')) throw new Error('Unicidade do carrinho convidado ausente.');
  const payments = await pg.sql(`SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN ('chk_order_financial_plan_values','chk_order_points_credited');
    SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND tgname='payment_policy_revision';`);
  if (!payments.split('\n').some(line => line.trim()==='2') || !payments.split('\n').some(line => line.trim()==='1')) throw new Error('Constraints/revisão financeira ausentes.');
  const diff = await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff',
    '--from-url', pg.env.DATABASE_URL, '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { env: pg.env, capture: true });
  if (diff.split('\n').some(line => line.trim() && !line.trim().startsWith('--'))) {
    console.error(diff);
    throw new Error('Histórico de migrations e schema.prisma divergentes.');
  }
  const recoveryIndex = await pg.sql(`SELECT pg_get_indexdef(indexrelid) FROM pg_index WHERE indexrelid = '"User_lojaID_resetToken_idx"'::regclass;`);
  if (!recoveryIndex.includes('"lojaID", "resetToken"')) throw new Error('Índice tenant/token de recuperação ausente ou divergente.');
  const partial = await pg.sql(`SELECT pg_get_indexdef(indexrelid) FROM pg_index WHERE indexrelid = '"Cart_active_owner_key"'::regclass;`);
  if (!partial.includes('UNIQUE') || !partial.includes('ACTIVE')) throw new Error('Unicidade parcial de carrinho ACTIVE ausente.');
  const loyaltyChecks = await pg.sql(`SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN
    ('chk_wallet_ready_balance','chk_wallet_expiration_lease','chk_loyalty_accounting_effect');`);
  if (!loyaltyChecks.split('\n').some(line => line.trim() === '3')) throw new Error('Constraints de fidelidade ausentes.');
  const freightTriggers = await pg.sql(`SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled = 'O' AND tgname IN
    ('freight_settings_revision','freight_rule_revision','freight_jt_rate_revision','freight_jt_geography_revision');`);
  if (!freightTriggers.split('\n').some(line => line.trim() === '4')) throw new Error('Triggers de revisão de frete ausentes.');
  const freightRevision = await pg.sql(`SELECT count(*) FROM "FreightTariffRevision" WHERE id='JT_EXPRESS';`);
  if (!freightRevision.split('\n').some(line => line.trim() === '1')) throw new Error('Revisão persistida de tarifas ausente.');
  const geography = await pg.sql(`SELECT count(*) FROM pg_constraint WHERE conname='chk_freight_rule_geography' AND convalidated;`);
  if (!geography.split('\n').some(line => line.trim() === '1')) throw new Error('Constraint geográfica de frete ausente.');
}

const pg = await provisionPostgres();
try {
  console.log('[schema] Aplicando todo o histórico em PostgreSQL vazio e descartável.');
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: pg.env });
  await assertSchema(pg);
  // Prisma does not model CHECK constraints: verify them independently.
  const constraints = await pg.sql(`SELECT conname FROM pg_constraint WHERE conname IN (
    'chk_product_price_non_negative', 'chk_product_stock_non_negative', 'chk_variant_stock_non_negative',
    'chk_cartitem_quantity_positive', 'chk_cartitem_price_non_negative', 'chk_order_total_non_negative',
    'chk_order_subtotal_non_negative', 'chk_order_shipping_non_negative', 'chk_orderitem_quantity_positive',
    'chk_orderitem_price_non_negative', 'chk_freightrule_value_non_negative') ORDER BY conname;`);
  if (!constraints.includes('(11 rows)')) throw new Error('Constraints monetárias/de estoque não foram preservadas.');
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: pg.env });
  console.log('[schema] Diff vazio, 11 CHECKs preservados e segundo deploy sem alterações.');
} catch (error) {
  console.error(error.message.replaceAll(pg.env.DATABASE_URL, '[redacted]'));
  process.exitCode = 1;
} finally { await pg.dispose(); }

// This synthetic upgrade is useful evidence, but is not a restored production
// backup and must never be described as such in release documentation.
if (!process.exitCode) {
  const legacy = await provisionPostgres();
  const baseline = await fs.mkdtemp(path.join(os.tmpdir(), 'logic-audit-migrations-'));
  try {
    await fs.copyFile('prisma/schema.prisma', path.join(baseline, 'schema.prisma'));
    const history = path.join(baseline, 'migrations');
    await fs.mkdir(history);
    for (const entry of await fs.readdir('prisma/migrations', { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name >= '20261003000000_complete_runtime_schema') continue;
      await fs.cp(path.join('prisma/migrations', entry.name), path.join(history, entry.name), { recursive: true });
    }
    await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', path.join(baseline, 'schema.prisma')], { env: legacy.env, capture: true });
    const fixtureSql = `
      INSERT INTO "Loja" (id,name,slug,description,"coverImageUrl","updatedAt") VALUES ('legacy-store','Legacy','legacy-store','','',now());
      INSERT INTO "User" (id,name,email,password,"lojaID","updatedAt") VALUES ('legacy-user','Legacy','legacy@example.test','','legacy-store',now());
      INSERT INTO "User" (id,name,email,password,"lojaID","updatedAt") VALUES ('legacy-negative-user','Legacy negative','negative@example.test','','legacy-store',now());
      UPDATE "User" SET password='fixture-password-preserved', "resetToken"='legacy-plaintext-fixture-token',
        "resetTokenExpires"='2026-10-06 12:00:00' WHERE id='legacy-user';
      INSERT INTO "LoyaltyWallet" (id,"lojaID","userID",balance,version) VALUES ('legacy-wallet','legacy-store','legacy-user',100,7), ('legacy-negative-wallet','legacy-store','legacy-negative-user',-25,4);
      INSERT INTO "LoyaltyTransaction" (id,"lojaID","userID",type,points,"balanceAfter",description,"expiresAt")
        VALUES ('legacy-credit','legacy-store','legacy-user','EARN',100,100,'Unknown consumed history',now()-interval '1 day');
      INSERT INTO "Product" (id,name,description,price,"imageUrl",stock,"lojaID","userID","updatedAt") VALUES ('legacy-product','Legacy','',100.20,'',10,'legacy-store','legacy-user',now());
      INSERT INTO "ProductVariants" (id,"ProductID",size,color,stock,"updatedAt") VALUES ('legacy-variant','legacy-product','Único','Padrão',10,now());
      INSERT INTO "Address" (id,cep,state,city,district,street,number,"userID","updatedAt") VALUES ('legacy-address','01001000','SP','São Paulo','Centro','Rua','1','legacy-user',now());
      INSERT INTO "Order" (id,"userID","addressID","lojaID","deliveryType",subtotal,total,"updatedAt") VALUES ('legacy-order','legacy-user','legacy-address','legacy-store','PICKUP',100.20,100.20,now());
      INSERT INTO "OrderItem" (id,"orderId","productId",name,quantity,price,"productVariantsId") VALUES ('legacy-item','legacy-order','legacy-product','Legacy',1,100.20,'legacy-variant');
      INSERT INTO "FreightRule" (id,"lojaID","cityName",value,"updatedAt") VALUES ('legacy-freight','legacy-store','São Paulo',15,now());
      INSERT INTO "Cart" (id,"userID",status,"updatedAt") VALUES ('owned-legacy-cart','legacy-user','ABANDONED',now());
      INSERT INTO "CartItem" (id,"cartID","productID","variantID",quantity,price,"productName","imageUrl",size,color,"updatedAt")
        VALUES ('owned-legacy-item','owned-legacy-cart','legacy-product','legacy-variant',1,100.20,'Legacy','','Único','Padrão',now());
    `;
    await legacy.sql(fixtureSql);
    const snapshot = () => legacy.sql(`SELECT p.id, p.price, p.stock, v.id, v.stock, o.id, o."orderNumber", o.total, oi.id, oi."productVariantsId"
      FROM "Product" p JOIN "ProductVariants" v ON v."ProductID"=p.id
      JOIN "OrderItem" oi ON oi."productId"=p.id JOIN "Order" o ON o.id=oi."orderId";`);
    const before = await snapshot();
    const recoverySnapshot = () => legacy.sql(`SELECT id,password,"resetToken","resetTokenExpires",status,role,"lojaID" FROM "User" WHERE id='legacy-user';`);
    const recoveryBefore = await recoverySnapshot();
    const loyaltySnapshot = () => legacy.sql(`SELECT id,balance,pending,"lifetimeEarn",version,"createdAt","updatedAt" FROM "LoyaltyWallet" ORDER BY id;
      SELECT id,points,"balanceAfter","expiresAt",description FROM "LoyaltyTransaction" ORDER BY id;`);
    const loyaltyBefore = await loyaltySnapshot();
    // Simulate manually synchronized objects with only the old history recorded.
    await legacy.sql('SET ROLE ecommerce_test;\n' + await fs.readFile('prisma/migrations/20261003000000_complete_runtime_schema/migration.sql', 'utf8'));
    // A valid old FK graph can still associate a cart with another store's
    // product. The new ownership migration must reject it before any backfill.
    await legacy.sql(`
      INSERT INTO "Loja" (id,name,slug,description,"coverImageUrl","updatedAt") VALUES ('foreign-store','Foreign','foreign-store','','',now());
      INSERT INTO "User" (id,name,email,password,"lojaID","updatedAt") VALUES ('foreign-user','Foreign','foreign@example.test','','foreign-store',now());
      INSERT INTO "Cart" (id,"userID",status,"updatedAt") VALUES ('foreign-cart','foreign-user','ACTIVE',now());
      INSERT INTO "CartItem" (id,"cartID","productID","variantID",quantity,price,"productName","imageUrl",size,color,"updatedAt")
        VALUES ('foreign-item','foreign-cart','legacy-product','legacy-variant',1,100.20,'Legacy','','Único','Padrão',now());
    `);
    let rejected = false;
    try { await legacy.sql(await fs.readFile('prisma/migrations/20261005000000_purchase_tenant_scope/migration.sql', 'utf8')); }
    catch (error) { if (!error.message.includes('PURCHASE_TENANT_BACKFILL_BLOCKED')) throw error; rejected = true; }
    if (!rejected) throw new Error('Migration de ownership aceitou vínculo cross-tenant legado.');
    const column = await legacy.sql(`SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='Cart' AND column_name='lojaID';`);
    if (!/\b0\b/.test(column) || await snapshot() !== before) throw new Error('Migration rejeitada deixou alterações parciais.');
    await legacy.sql(`DELETE FROM "CartItem" WHERE id='foreign-item'; DELETE FROM "Cart" WHERE id='foreign-cart';
      DELETE FROM "User" WHERE id='foreign-user'; DELETE FROM "Loja" WHERE id='foreign-store';`);
    console.log('[schema] Ownership legado incompatível foi bloqueado, sem backfill parcial nem reassociação.');
    // Inject an interruption AFTER ALTER COLUMN, at the actual ownership UPDATE.
    // This exercises all-or-nothing DDL/DML and retry of the exact migration.
    const cartBefore = await legacy.sql('SELECT row_to_json(c) FROM "Cart" c ORDER BY id; SELECT row_to_json(i) FROM "CartItem" i ORDER BY id;');
    await legacy.sql(`CREATE FUNCTION wf18_interrupt() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'WF18_FIXTURE_INTERRUPTION'; END $$;
      CREATE TRIGGER wf18_interrupt BEFORE UPDATE ON "Cart" FOR EACH ROW EXECUTE FUNCTION wf18_interrupt();`);
    let interrupted = false;
    try { await legacy.sql(await fs.readFile('prisma/migrations/20261005000000_purchase_tenant_scope/migration.sql','utf8')); }
    catch (error) { if (!error.message.includes('WF18_FIXTURE_INTERRUPTION')) throw error; interrupted = true; }
    const partialColumn = await legacy.sql(`SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='Cart' AND column_name='lojaID';`);
    if (!interrupted || !/\b0\b/.test(partialColumn) || await legacy.sql('SELECT row_to_json(c) FROM "Cart" c ORDER BY id; SELECT row_to_json(i) FROM "CartItem" i ORDER BY id;')!==cartBefore) throw new Error('Interrupção deixou backfill parcial.');
    await legacy.sql('DROP TRIGGER wf18_interrupt ON "Cart"; DROP FUNCTION wf18_interrupt();');
    console.log('[schema] Interrupção no UPDATE de ownership reverteu DDL/dados; retomando o mesmo artefato.');
    await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: legacy.env, capture: true });
    await assertSchema(legacy);
    const ownerCheck = await legacy.sql(`SELECT count(*) FROM "Cart" c JOIN "User" u ON u.id=c."userID" WHERE c.id='owned-legacy-cart' AND c."lojaID"=u."lojaID";
      SELECT count(*) FROM "CartItem" i JOIN "Cart" c ON c.id=i."cartID" WHERE i.id='owned-legacy-item' AND i."lojaID"=c."lojaID";`);
    if (ownerCheck.split('\n').filter(line=>line.trim()==='1').length!==2) throw new Error('Backfill demonstrável de ownership não fechou.');
    const upgradedCart = await legacy.sql('SELECT row_to_json(c) FROM "Cart" c ORDER BY id; SELECT row_to_json(i) FROM "CartItem" i ORDER BY id;');
    await command(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{ env:legacy.env,capture:true });
    if (await legacy.sql('SELECT row_to_json(c) FROM "Cart" c ORDER BY id; SELECT row_to_json(i) FROM "CartItem" i ORDER BY id;')!==upgradedCart) throw new Error('Replay alterou o backfill confirmado.');
    console.log('[schema] Tenant de um carrinho/item herdado pelo vínculo real; replay sem duplicação ou alteração.');
    if (await snapshot() !== before) throw new Error('Upgrade alterou IDs, vínculos, totais, estoque ou número do pedido da fixture.');
    if (await recoverySnapshot() !== recoveryBefore) throw new Error('Upgrade alterou senha/token/prazo/elegibilidade da fixture legada.');
    const legacyFreight = await legacy.sql(`SELECT count(*) FROM "FreightRule" WHERE id='legacy-freight' AND "cityName"='São Paulo' AND value=15 AND state IS NULL AND "municipalityCode" IS NULL;
      SELECT count(*) FROM "Order" WHERE id='legacy-order' AND "freightQuoteId" IS NULL AND "freightSnapshot" IS NULL;`);
    if (legacyFreight.split('\n').filter(line => line.trim() === '1').length !== 2) throw new Error('Upgrade alterou frete legado ou inventou geografia/snapshot.');
    const inventedPayment = await legacy.sql(`SELECT count(*) FROM "Order" WHERE "financialPlan" IS NOT NULL OR "loyaltyEarnSnapshot" IS NOT NULL OR "pointsCredited" <> 0;
      SELECT count(*) FROM "Loja" WHERE "enableManualPix" OR "enablePix" OR "enableBoleto" OR "enableCreditCard";`);
    if (inventedPayment.split('\n').filter(line => line.trim()==='0').length !== 2) throw new Error('Upgrade fabricou plano/ganho ou habilitou pagamento legado.');
    console.log('[schema] Plano/ganho histórico não inferido, flags financeiras desabilitadas.');
    console.log('[schema] Regra legada e pedido preservados; nenhum município, token ou snapshot inferido.');
    console.log('[schema] Senha, token em texto, prazo e elegibilidade legados preservados; nenhum hash/backfill fabricado.');
    if (await loyaltySnapshot() !== loyaltyBefore) throw new Error('Upgrade alterou saldo/ledger legado de fidelidade.');
    const activated = await legacy.sql(`SELECT count(*) FROM "LoyaltyWallet" WHERE "accountingReady";`);
    const inferredLots = await legacy.sql(`SELECT count(*) FROM "LoyaltyLot";`);
    if (![activated, inferredLots].every(output => output.split('\n').some(line => line.trim() === '0'))) throw new Error('Upgrade inferiu origem/ativação do saldo legado.');
    console.log('[schema] Fidelidade legada positiva/negativa preservada; nenhum lote/prazo inferido ou carteira ativada.');
    console.log('[schema] Upgrade sintético com objetos já existentes preservou IDs, FKs, valores, estoque e número do pedido.');
    // Only this disposable synthetic DB: recreate a pre-index duplicate state
    // to prove the migration refuses to silently select/merge/delete a cart.
    await legacy.sql(`DROP INDEX "Cart_active_owner_key";
      INSERT INTO "Cart" (id,"lojaID","userID",status,"updatedAt") VALUES
        ('duplicate-cart-a','legacy-store','legacy-user','ACTIVE',now()),
        ('duplicate-cart-b','legacy-store','legacy-user','ACTIVE',now());`);
    const cartsBefore = await legacy.sql(`SELECT id,status,version FROM "Cart" ORDER BY id;`);
    let duplicateRejected = false;
    const activeMigration = await fs.readFile('prisma/migrations/20261005040000_cart_active_uniqueness/migration.sql', 'utf8');
    try { await legacy.sql('SET ROLE ecommerce_test;\n' + activeMigration); }
    catch (error) { if (!error.message.includes('Active cart duplicates')) throw error; duplicateRejected = true; }
    if (!duplicateRejected || await legacy.sql(`SELECT id,status,version FROM "Cart" ORDER BY id;`) !== cartsBefore) throw new Error('Guard de carrinhos duplicados não preservou a fixture.');
    const indexAfterReject = await legacy.sql(`SELECT count(*) FROM pg_indexes WHERE indexname='Cart_active_owner_key';`);
    if (!/\b0\b/.test(indexAfterReject)) throw new Error('Migration rejeitada criou índice parcial.');
    // Explicit fixture resolution, not an automatic business-data backfill.
    await legacy.sql(`UPDATE "Cart" SET status='ABANDONED' WHERE id='duplicate-cart-b';`);
    await legacy.sql('SET ROLE ecommerce_test;\n' + activeMigration);
    await assertSchema(legacy);
    if (await snapshot() !== before) throw new Error('Ensaio de duplicatas alterou entidades originais.');
    console.log('[schema] Duplicatas ACTIVE bloquearam migration sem escolher/apagar/mesclar carrinhos; índice aprovado após resolução explícita da fixture.');
  } catch (error) {
    console.error(error.message.replaceAll(legacy.env.DATABASE_URL, '[redacted]'));
    process.exitCode = 1;
  } finally {
    await legacy.dispose();
    if (path.dirname(path.resolve(baseline)) !== path.resolve(os.tmpdir()) || !path.basename(baseline).startsWith('logic-audit-migrations-')) {
      throw new Error('Diretório temporário de migrations divergente: descarte bloqueado.');
    }
    await fs.rm(baseline, { recursive: true, force: true });
  }
}
