// WF-03: the only source operation is a read-only pg_dump. All DDL/DML below
// targets a container created by this process and checked by its random label.
// Full backups contain personal data: never place them in this repository.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import nextEnv from '@next/env';
import { command, provisionPostgres } from './lib/disposable-postgres.mjs';
import { LEGACY_AUDIT_SQL, classifyLegacyAudit } from './lib/legacy-commerce-audit.mjs';

if (process.platform !== 'win32') throw new Error('Este executor exige DPAPI/ACL do Windows para proteger o backup.');
const args = process.argv.slice(2);
const auditLegacy = args.length === 3 && args[2] === '--audit-legacy';
const reuse = (args.length === 2 || auditLegacy) && args[0] === '--backup-dir';
if (!(args.length === 1 && args[0] === '--capture-source') && !reuse) {
  throw new Error('Use --capture-source ou --backup-dir <diretório privado existente> [--audit-legacy].');
}
let sourceEnv;
if (!reuse) {
  nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  if (!process.env.DIRECT_URL) throw new Error('DIRECT_URL explícita é necessária; não há fallback para conexão pooled.');
  const source = new URL(process.env.DIRECT_URL);
  if (!['postgres:', 'postgresql:'].includes(source.protocol)) throw new Error('Protocolo da origem inválido.');
  sourceEnv = { ...process.env, PGHOST: source.hostname, PGPORT: source.port || '5432',
    PGDATABASE: decodeURIComponent(source.pathname.slice(1)), PGUSER: decodeURIComponent(source.username),
    PGPASSWORD: decodeURIComponent(source.password), PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15',
    PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=120000',
    PGAPPNAME: 'logic-audit-readonly-backup' };
}
const sourceArgs = ['run', '--rm', '-i', ...['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
  'PGSSLMODE', 'PGCONNECT_TIMEOUT', 'PGOPTIONS', 'PGAPPNAME'].flatMap(name => ['--env', name]), 'postgres:18-alpine'];
const q = name => '"' + name.replaceAll('"', '""') + '"';
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const tables = ['Address', 'AuditLog', 'Brand', 'Cart', 'CartItem', 'CategoryTag', 'FreightRule',
  'JtExpressGeocom', 'JtExpressRate', 'Loja', 'LoyaltyTransaction', 'LoyaltyWallet', 'Order',
  'OrderItem', 'OrderStatusHistory', 'PaymentWebhookEvent', 'Product', 'ProductCategoryTag',
  'ProductVariants', 'Session', 'StockSyncLog', 'User', '_prisma_migrations'].sort();

async function binary(file, argv, { env = process.env, input } = {}) {
  const child = spawn(file, argv, { env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const buffers = []; let size = 0;
  const finished = new Promise((resolve, reject) => {
    child.on('error', () => reject(new Error('Não foi possível iniciar o processo do backup/restore.')));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Processo de backup/restore falhou (${code}); saída omitida para proteger dados.`)));
  });
  const errors = [];
  child.stderr.on('data', data => errors.push(data));
  child.stdout.on('data', buffer => {
    size += buffer.length;
    if (size > 256 * 1024 * 1024) child.kill();
    else buffers.push(buffer);
  });
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  try { await finished; }
  catch (error) {
    // Keep details solely in the ACL-protected directory; SQL errors may carry PII.
    await fs.writeFile(path.join(privateDir, `failure-${randomBytes(8).toString('hex')}.private.log`), Buffer.concat(errors), { flag: 'wx' });
    throw error;
  }
  return Buffer.concat(buffers);
}
async function dpapi(value, decrypt = false) {
  const script = decrypt
    ? '$s = ConvertTo-SecureString ([Console]::In.ReadToEnd().Trim()); $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }'
    : '$s = ConvertTo-SecureString ([Console]::In.ReadToEnd().Trim()) -AsPlainText -Force; [Console]::Write((ConvertFrom-SecureString $s))';
  return (await binary('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input: value })).toString().trim();
}

const runId = randomBytes(16).toString('hex');
if (!process.env.LOCALAPPDATA) throw new Error('LOCALAPPDATA indisponível; não será usado o repositório para backup.');
const privateParent = path.resolve(process.env.LOCALAPPDATA, 'logic-audit-backups');
const privateDir = reuse ? path.resolve(args[1]) : path.join(privateParent, runId);
if (path.dirname(privateDir) !== privateParent || !/^[a-f0-9]{32}$/.test(path.basename(privateDir))) {
  throw new Error('Diretório de backup fora do destino privado permitido.');
}
if (reuse && (await fs.lstat(privateDir)).isSymbolicLink()) throw new Error('Não são aceitos links no destino do backup.');
await fs.mkdir(privateDir, { recursive: true });
const sid = (await command('whoami', ['/user', '/fo', 'csv', '/nh'], { capture: true })).match(/S-1-5-[0-9-]+/)?.[0];
if (!sid) throw new Error('Identidade Windows não pôde ser verificada.');
await command('icacls', [privateDir, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { capture: true });
const key = reuse ? Buffer.from(await dpapi(await fs.readFile(path.join(privateDir, 'key.dpapi'), 'utf8'), true), 'hex') : randomBytes(32);
if (!reuse) await fs.writeFile(path.join(privateDir, 'key.dpapi'), await dpapi(key.toString('hex')), { flag: 'wx' });
async function saveBackup(name, plaintext) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  await fs.writeFile(path.join(privateDir, name), Buffer.concat([nonce, cipher.getAuthTag(), encrypted]), { flag: 'wx' });
  return { bytes: plaintext.length, sha256: createHash('sha256').update(plaintext).digest('hex') };
}
async function readBackup(name, expected) {
  const recovered = Buffer.from(await dpapi(await fs.readFile(path.join(privateDir, 'key.dpapi'), 'utf8'), true), 'hex');
  const encrypted = await fs.readFile(path.join(privateDir, name));
  const decipher = createDecipheriv('aes-256-gcm', recovered, encrypted.subarray(0, 12));
  decipher.setAuthTag(encrypted.subarray(12, 28));
  const plaintext = Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]);
  recovered.fill(0);
  if (createHash('sha256').update(plaintext).digest('hex') !== expected.sha256) throw new Error('Hash do backup restaurável divergiu.');
  return plaintext;
}
async function assertClone(pg) {
  const label = await command('docker', ['inspect', '--format', '{{index .Config.Labels "logic-audit.run-id"}}', pg.name], { capture: true });
  if (label !== pg.runId || !/^ecommerce_test_[a-f0-9]{32}$/.test(pg.database)) throw new Error('Identidade do clone inválida.');
}
async function restore(pg, name, expected) {
  await assertClone(pg);
  // pg_dump includes CREATE SCHEMA public. Remove only the empty bootstrap
  // schema of this newly provisioned, label-verified container; never CASCADE.
  await pg.sql('DROP SCHEMA public;');
  const plaintext = await readBackup(name, expected);
  try {
    await binary('docker', ['exec', '-i', pg.name, 'pg_restore', '--no-owner', '--no-acl', '--exit-on-error',
      '--single-transaction', '-U', 'postgres', '-d', pg.database], { input: plaintext });
    await pg.sql('GRANT USAGE, CREATE ON SCHEMA public TO ecommerce_test;');
  } finally { plaintext.fill(0); }
}
const excluded = {
  User: ['name', 'email', 'password', 'phone', 'cpfCnpj', 'avatarImageUrl', 'resetToken', 'resetTokenExpires'],
  Address: ['cep', 'state', 'city', 'district', 'street', 'number', 'complement'],
  Loja: ['name', 'description', 'coverImageUrl', 'customDomain', 'pixKey', 'pixKeyType', 'whatsappNumber',
    'nuvemshopStoreId', 'nuvemshopAccessToken', 'nuvemshopUserAgent', 'originCep', 'originState', 'originCity',
    'originDistrict', 'originStreet', 'originNumber', 'originComplement', 'correiosContractCode', 'correiosPassword'],
  Session: ['expiresAt'], AuditLog: ['previousValue', 'newValue', 'ipAddress', 'metadata'],
  StockSyncLog: ['metadata'], PaymentWebhookEvent: ['payload'], LoyaltyTransaction: ['description'],
  OrderStatusHistory: ['ipAddress'], Order: ['customerCpfCnpj', 'pixKeyUsed', 'trackingCode', 'adminNotes',
    'asaasPaymentId', 'asaasInvoiceUrl', 'asaasBankSlipUrl', 'asaasDigitableLine', 'asaasBarCode', 'creditCardLast4',
    'nuvemshopOrderId', 'lastSyncError'],
};
// Numeric scale changes must not masquerade as a change in business amounts.
const money = { Cart: ['shippingCost'], FreightRule: ['value'], Order: ['freightValue', 'subtotal', 'shippingCost', 'total', 'pointsDiscountValue', 'installmentValue'] };
let originalColumns;
let originalHistoryNames;
async function fingerprint(pg, businessOnly = false, excludeSensitive = true) {
  const result = {};
  for (const table of tables) {
    let projection = businessOnly && originalColumns
      ? `(SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(t)) WHERE key = ANY(ARRAY[${originalColumns[table].map(literal).join(',')}]))`
      : 'to_jsonb(t)';
    if (businessOnly) {
      for (const field of [...(excludeSensitive ? excluded[table] || [] : []), ...(money[table] || [])]) projection += ` - ${literal(field)}`;
      for (const field of money[table] || []) projection += ` || jsonb_build_object(${literal(field)}, t.${q(field)}::numeric(65,30))`;
    }
    const where = businessOnly && table === '_prisma_migrations' && originalHistoryNames
      ? ` WHERE migration_name = ANY(ARRAY[${originalHistoryNames.map(literal).join(',')}])` : '';
    const output = await pg.sql(`SELECT json_build_object('rows', count(*), 'hash', md5(COALESCE(string_agg(md5((${projection})::text), '' ORDER BY (${projection})::text), ''))) FROM public.${q(table)} t${where};`);
    result[table] = JSON.parse(output.split('\n').find(line => line.trim().startsWith('{')));
  }
  return result;
}
async function sequences(pg) {
  const definition = await pg.sql(`SELECT format('%I.%I', schemaname, sequencename), last_value, start_value, increment_by, min_value, max_value, cache_size, cycle FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename;`);
  const output = await pg.sql(`SELECT COALESCE(json_agg(sequencename ORDER BY sequencename),'[]'::json) FROM pg_sequences WHERE schemaname='public';`);
  const names = JSON.parse(output.split('\n').find(line => line.trim().startsWith('[')));
  const states = {};
  for (const name of names) states[name] = await pg.sql(`SELECT last_value,is_called FROM public.${q(name)};`);
  return JSON.stringify({ definition, states });
}
async function catalog(pg) {
  return pg.sql(`SELECT json_build_object(
    'tables', (SELECT json_agg(json_build_object('name', c.relname, 'owner', pg_get_userbyid(c.relowner)) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
    'constraints', (SELECT json_agg(json_build_object('table',c.conrelid::regclass::text,'name',c.conname,'valid',c.convalidated,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conrelid::regclass::text,c.conname) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'),
    'indexes', (SELECT json_agg(json_build_object('table',tablename,'name',indexname,'definition',indexdef) ORDER BY tablename,indexname) FROM pg_indexes WHERE schemaname='public'),
    'enums', (SELECT json_agg(json_build_object('type',t.typname,'label',e.enumlabel,'position',e.enumsortorder) ORDER BY t.typname,e.enumsortorder) FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'),
    'columns', (SELECT json_agg(json_build_object('table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable,'default',column_default) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'));`);
}
let pg; let restored;
const evidence = { startedAt: new Date().toISOString(), runId, sourceReadOnly: true, backupScope: 'public schema; no global roles/ACL/owner replay', privateDir };
try {
  if (reuse) {
    const previous = JSON.parse(await fs.readFile(path.join(privateDir, 'evidence.json'), 'utf8'));
    evidence.source = previous.source; evidence.sourceCatalog = previous.sourceCatalog; evidence.backup = previous.backup;
    evidence.sourceCapturedAt = previous.sourceCapturedAt ?? previous.startedAt;
    console.log('[clone] Reutilizando backup protegido; nenhuma nova conexão com a origem.');
  } else {
  console.log('[clone] Inspeção da origem em modo somente leitura; saída limitada a metadados.');
  const metadata = await binary('docker', [...sourceArgs, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { env: sourceEnv,
    input: `SELECT json_build_object('version',current_setting('server_version'), 'readOnly',current_setting('transaction_read_only'),
      'tables',(SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'),
      'customFunctions',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
      'foreignServers',(SELECT count(*) FROM pg_foreign_server));` });
  evidence.source = JSON.parse(metadata.toString().trim());
  if (!evidence.source.version.startsWith('18.') || evidence.source.readOnly !== 'on'
    || JSON.stringify(evidence.source.tables) !== JSON.stringify(tables)
    || evidence.source.customFunctions !== 0 || evidence.source.foreignServers !== 0) {
    throw new Error('Origem fora do catálogo/versionamento revisado; revisar o executor antes de exportar.');
  }
  evidence.sourceCatalog = await catalog({ sql: async input => (await binary('docker', [...sourceArgs,
    'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { env: sourceEnv, input })).toString().trim() });
  console.log('[clone] Gerando backup consistente, criptografado com AES-GCM e chave protegida por DPAPI.');
  const dump = await binary('docker', [...sourceArgs, 'pg_dump', '--format=custom', '--schema=public',
    '--no-owner', '--no-acl', '--no-comments', '--no-security-labels', '--lock-wait-timeout=15s'], { env: sourceEnv });
  evidence.backup = await saveBackup('source.dump.enc', dump); dump.fill(0);
  }
  evidence.stage = 'provision';
  pg = await provisionPostgres({ majorVersion: 18 });
  evidence.stage = 'restore';
  await restore(pg, 'source.dump.enc', evidence.backup);
  evidence.restoredCatalog = await catalog(pg);
  evidence.rawFingerprint = await fingerprint(pg);
  const columns = await pg.sql(`SELECT json_object_agg(table_name,columns) FROM (SELECT table_name,json_agg(column_name ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name) c;`);
  originalColumns = JSON.parse(columns.split('\n').find(line => line.trim().startsWith('{')));
  const names = await pg.sql(`SELECT json_agg(DISTINCT migration_name) FROM "_prisma_migrations";`);
  originalHistoryNames = JSON.parse(names.split('\n').find(line => line.trim().startsWith('[')));
  evidence.sequencesBefore = await sequences(pg);
  if (auditLegacy) {
    // Aggregates before anonymization: the subsequent audit must not mistake
    // deliberately expired sessions/redacted reset tokens for the source state.
    evidence.preSanitizationEligibility = await pg.sql(`SELECT json_build_object(
      'activeSessions',(SELECT count(*) FROM "Session" WHERE "expiresAt">now()),
      'activeLegacyResetTokens',(SELECT count(*) FROM "User" WHERE "resetToken" IS NOT NULL AND "resetTokenExpires">now()
        AND "resetToken" !~ '^[a-f0-9]{64}$'));`);
  }
  // A second restoration proves recovery from the persisted encrypted artifact,
  // including DPAPI unwrap; it is not just a comparison with a memory buffer.
  restored = await provisionPostgres({ majorVersion: 18 });
  await restore(restored, 'source.dump.enc', evidence.backup);
  if (JSON.stringify(await fingerprint(restored)) !== JSON.stringify(evidence.rawFingerprint)
    || await sequences(restored) !== evidence.sequencesBefore) throw new Error('Segundo restore divergiu do snapshot exportado.');
  await restored.dispose(); restored = undefined;
  console.log('[clone] Dois restores equivalentes; sanitizando apenas o clone.');
  await assertClone(pg);
  const beforeSanitization = await fingerprint(pg, true);
  await pg.sql(`BEGIN;
    UPDATE "User" SET name='Pessoa de teste', email='user-'||md5(id)||'@example.invalid', password='DISABLED-CLONE', phone=NULL, "cpfCnpj"=NULL, "avatarImageUrl"=NULL, "resetToken"=NULL, "resetTokenExpires"=NULL;
    UPDATE "Address" SET cep='01001000', state='SP', city='Cidade de teste', district='Bairro de teste', street='Rua de teste', number='1', complement=NULL;
    UPDATE "Loja" SET name='Loja de teste', description='', "coverImageUrl"='', "customDomain"=NULL, "pixKey"=NULL, "pixKeyType"=NULL, "whatsappNumber"=NULL, "nuvemshopStoreId"=NULL, "nuvemshopAccessToken"=NULL, "nuvemshopUserAgent"=NULL, "originCep"='01001000', "originState"='SP', "originCity"='Cidade de teste', "originDistrict"='Bairro de teste', "originStreet"='Rua de teste', "originNumber"='1', "originComplement"=NULL, "correiosContractCode"=NULL, "correiosPassword"=NULL;
    UPDATE "Session" SET "expiresAt"=LEAST("expiresAt", now()-interval '1 day');
    UPDATE "AuditLog" SET "previousValue"=NULL, "newValue"=NULL, "ipAddress"=NULL, metadata=NULL;
    UPDATE "StockSyncLog" SET metadata=NULL;
    UPDATE "PaymentWebhookEvent" SET payload='{"sanitized":true}'::jsonb;
    UPDATE "LoyaltyTransaction" SET description='Registro sanitizado';
    UPDATE "OrderStatusHistory" SET "ipAddress"=NULL;
    UPDATE "Order" SET "customerCpfCnpj"=NULL, "pixKeyUsed"=NULL, "trackingCode"=NULL, "adminNotes"=NULL, "asaasPaymentId"=CASE WHEN "asaasPaymentId" IS NULL THEN NULL ELSE 'clone_'||md5(id) END,
      "asaasInvoiceUrl"=NULL, "asaasBankSlipUrl"=NULL, "asaasDigitableLine"=NULL, "asaasBarCode"=NULL, "creditCardLast4"=NULL, "nuvemshopOrderId"=CASE WHEN "nuvemshopOrderId" IS NULL THEN NULL ELSE 'clone_'||md5(id) END, "lastSyncError"=NULL;
    COMMIT;`);
  evidence.businessFingerprint = await fingerprint(pg, true);
  if (JSON.stringify(beforeSanitization) !== JSON.stringify(evidence.businessFingerprint)) throw new Error('Sanitização alterou dados/vínculos fora dos campos autorizados.');
  evidence.sanitizedFullFingerprint = await fingerprint(pg, true, false);
  const sanitized = await binary('docker', ['exec', pg.name, 'pg_dump', '-U', 'postgres', '-d', pg.database,
    '--format=custom', '--schema=public', '--no-owner', '--no-acl', '--no-comments', '--no-security-labels']);
  const sanitizedName = `sanitized-${runId}.dump.enc`;
  evidence.sanitizedBackup = { name: sanitizedName, ...await saveBackup(sanitizedName, sanitized) }; sanitized.fill(0);
  evidence.stage = 'sanitized-restore';
  restored = await provisionPostgres({ majorVersion: 18 });
  await restore(restored, sanitizedName, evidence.sanitizedBackup);
  if (JSON.stringify(await fingerprint(restored, true, false)) !== JSON.stringify(evidence.sanitizedFullFingerprint)
    || await sequences(restored) !== evidence.sequencesBefore) throw new Error('Restore sanitizado alterou dados/vínculos/sequências.');
  evidence.sanitizedRestoreVerified = true;
  await restored.dispose(); restored = undefined;
  evidence.migrationHistory = await pg.sql(`SELECT migration_name, checksum, count(*) AS registrations, bool_and(finished_at IS NOT NULL AND rolled_back_at IS NULL) AS completed FROM "_prisma_migrations" GROUP BY migration_name,checksum ORDER BY migration_name,checksum;`);
  const historyOutput = await pg.sql(`SELECT json_agg(json_build_object('name',migration_name,'checksum',checksum,'finished',finished_at IS NOT NULL,'rolledBack',rolled_back_at IS NOT NULL) ORDER BY migration_name,id) FROM "_prisma_migrations";`);
  const history = JSON.parse(historyOutput.split('\n').find(line => line.trim().startsWith('[')));
  for (const entry of history) {
    const sql = await fs.readFile(path.join('prisma/migrations', entry.name, 'migration.sql'), 'utf8');
    const hashes = [sql, sql.replaceAll('\r\n', '\n'), sql.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n')]
      .map(text => createHash('sha256').update(text).digest('hex'));
    if (!entry.finished || entry.rolledBack || !hashes.includes(entry.checksum)) {
      throw new Error('Histórico restaurado diverge dos artefatos versionados; não será reescrito.');
    }
  }
  evidence.historyVerified = true;
  // The source deploy role owns the application objects. Match that capability
  // in the clone without importing any source role/password or relaxing sentinel protection.
  await pg.sql(`DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','S') ORDER BY CASE WHEN c.relkind='r' THEN 0 ELSE 1 END LOOP
      EXECUTE format('ALTER %s public.%I OWNER TO ecommerce_test', CASE WHEN r.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END, r.relname);
    END LOOP;
    FOR r IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e' LOOP
      EXECUTE format('ALTER TYPE public.%I OWNER TO ecommerce_test',r.typname);
    END LOOP;
  END $$;`);
  const started = Date.now();
  evidence.stage = 'migrate-deploy';
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: pg.env, capture: true });
  evidence.migrationElapsedMs = Date.now() - started;
  evidence.catalogAfter = await catalog(pg);
  const checkCount = await pg.sql(`SELECT count(*) AS checks FROM pg_constraint WHERE connamespace='public'::regnamespace AND convalidated AND conname IN (
    'chk_product_price_non_negative','chk_product_stock_non_negative','chk_variant_stock_non_negative',
    'chk_cartitem_quantity_positive','chk_cartitem_price_non_negative','chk_order_total_non_negative',
    'chk_order_subtotal_non_negative','chk_order_shipping_non_negative','chk_orderitem_quantity_positive',
    'chk_orderitem_price_non_negative','chk_freightrule_value_non_negative');`);
  evidence.checksPreserved = checkCount.split('\n').some(line => line.trim() === '11');
  if (!evidence.checksPreserved) throw new Error('Constraints históricas não preservadas no clone.');
  const loyaltyChecks = await pg.sql(`SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN
    ('chk_wallet_ready_balance','chk_wallet_expiration_lease','chk_loyalty_accounting_effect');`);
  evidence.loyaltyChecksPreserved = loyaltyChecks.split('\n').some(line => line.trim() === '3');
  if (!evidence.loyaltyChecksPreserved) throw new Error('Constraints novas de fidelidade ausentes no clone.');
  evidence.loyaltyLegacyActivation = await pg.sql(`SELECT count(*) AS activated FROM "LoyaltyWallet" WHERE "accountingReady";`);
  if (!evidence.loyaltyLegacyActivation.split('\n').some(line => line.trim() === '0')) throw new Error('Upgrade ativou carteira histórica sem conciliação.');
  const freightChecks = await pg.sql(`SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND tgname IN
    ('freight_settings_revision','freight_rule_revision','freight_jt_rate_revision','freight_jt_geography_revision');
    SELECT count(*) FROM pg_constraint WHERE convalidated AND conname='chk_freight_rule_geography';`);
  evidence.freightAuthorityChecks = freightChecks.split('\n').some(line => line.trim() === '4') && freightChecks.split('\n').some(line => line.trim() === '1');
  if (!evidence.freightAuthorityChecks) throw new Error('Revisões/constraint de frete ausentes no clone.');
  const inferredFreight = await pg.sql(`SELECT count(*) FROM "FreightRule" WHERE state IS NOT NULL OR "municipalityCode" IS NOT NULL;
    SELECT count(*) FROM "Order" WHERE "freightQuoteId" IS NOT NULL OR "freightSnapshot" IS NOT NULL;`);
  evidence.freightLegacyPreserved = inferredFreight.split('\n').filter(line => line.trim() === '0').length === 2;
  if (!evidence.freightLegacyPreserved) throw new Error('Upgrade fabricou geografia/cotação histórica.');
  const paymentChecks = await pg.sql(`SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN ('chk_order_financial_plan_values','chk_order_points_credited');
    SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND tgname='payment_policy_revision';`);
  evidence.paymentAuthorityChecks = paymentChecks.split('\n').some(line => line.trim()==='2') && paymentChecks.split('\n').some(line => line.trim()==='1');
  if (!evidence.paymentAuthorityChecks) throw new Error('Constraints/revisão financeira ausentes no clone.');
  const checkoutChecks = await pg.sql(`SELECT count(*) FROM pg_constraint WHERE convalidated AND conname='chk_checkout_intent_source';
    SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND tgname IN
      ('inventory_reservation_source','checkout_commit_complete','checkout_intent_immutable','checkout_cart_consumed','checkout_basket_consumed');`);
  evidence.checkoutAuthorityChecks = checkoutChecks.split('\n').some(line => line.trim()==='1') && checkoutChecks.split('\n').some(line => line.trim()==='5');
  if (!evidence.checkoutAuthorityChecks) throw new Error('Protocolo de intenção/reserva/consumo ausente no clone.');
  const durableChecks = await pg.sql(`SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND tgname IN ('PaymentOperation_provenance','FinancialFact_provenance');
    SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN ('PaymentAttempt_lease_pair','PaymentAttempt_reconcile_nonnegative','PaymentOperation_kind_check','PaymentOperation_status_check');
    SELECT count(*) FROM "PaymentOperation"; SELECT count(*) FROM "FinancialFact";`);
  evidence.durablePaymentChecks = durableChecks.split('\n').some(line => line.trim()==='2') && durableChecks.split('\n').some(line => line.trim()==='4');
  if (!evidence.durablePaymentChecks || durableChecks.split('\n').filter(line => line.trim()==='0').length !== 2) throw new Error('Executor financeiro ausente ou evidência histórica fabricada.');
  const inventedCheckout = await pg.sql(`SELECT count(*) FROM "Order" WHERE "checkoutIntentID" IS NOT NULL OR "sourceCartID" IS NOT NULL;
    SELECT count(*) FROM "InventoryReservation";
    SELECT count(*) FROM "CheckoutBasket";`);
  evidence.checkoutLegacyPreserved = inventedCheckout.split('\n').filter(line => line.trim()==='0').length === 3;
  if (!evidence.checkoutLegacyPreserved) throw new Error('Upgrade fabricou intenção, reserva ou carrinho histórico.');
  const inventedPayment = await pg.sql(`SELECT count(*) FROM "Order" WHERE "financialPlan" IS NOT NULL OR "loyaltyEarnSnapshot" IS NOT NULL OR "pointsCredited" <> 0;
    SELECT count(*) FROM "Loja" WHERE "enableManualPix" OR "enablePix" OR "enableBoleto" OR "enableCreditCard";`);
  evidence.paymentLegacyPreserved = inventedPayment.split('\n').filter(line => line.trim()==='0').length === 2;
  if (!evidence.paymentLegacyPreserved) throw new Error('Upgrade fabricou plano/ganho ou habilitou pagamento legado.');
  evidence.diff = await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff',
    '--from-url', pg.env.DATABASE_URL, '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { env: pg.env, capture: true });
  // After sanitization there are no further authorized data changes. Compare
  // every original column, including the redacted fields and audit JSON.
  evidence.dataPreserved = JSON.stringify(await fingerprint(pg, true, false)) === JSON.stringify(evidence.sanitizedFullFingerprint);
  evidence.sequencesPreserved = await sequences(pg) === evidence.sequencesBefore;
  if (!evidence.dataPreserved || !evidence.sequencesPreserved) throw new Error('Upgrade alterou os dados de negócio/sequências do snapshot.');
  if (evidence.diff.split('\n').some(line => line.trim() && !line.trim().startsWith('--'))) {
    console.log(evidence.diff); // DDL only: no credentials or row contents.
    throw new Error('Clone revela drift residual; revisar migration versionada antes de encerrar WF-03.');
  }
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: pg.env, capture: true });
  if (auditLegacy) {
    evidence.stage = 'legacy-commerce-audit';
    await assertClone(pg);
    const auditBefore = await fingerprint(pg, true, false);
    const auditSequences = await sequences(pg);
    const output = await pg.sql('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout=120000;\n' + LEGACY_AUDIT_SQL + '\nCOMMIT;');
    const raw = JSON.parse(output.split('\n').find(line => line.trim().startsWith('{')));
    const report = await classifyLegacyAudit(raw, runId);
    report.sanitizationLimits = ['Session.expiresAt','User.resetToken/resetTokenExpires','buyer/address personal values','trackingCode'];
    report.sourceCaptureAt = evidence.sourceCapturedAt ?? evidence.startedAt;
    evidence.legacyAudit = { name: `legacy-commerce-${runId}.json.enc`, ...await saveBackup(`legacy-commerce-${runId}.json.enc`, Buffer.from(JSON.stringify(report,null,2))) };
    evidence.legacyAuditSummary = {
      integrityPassed:report.integrityPassed,requiresReconciliation:report.requiresReconciliation,productionReady:false,
      tenants:report.tenants.map(t=>({ tenantTag:t.tenantTag,counts:t.counts,integrityBlockers:t.integrityBlockers,reviewReasons:t.reviewReasons })),
      duplicateGroups:report.duplicateGroups.length,contract:report.contract,
    };
    if (JSON.stringify(await fingerprint(pg,true,false))!==JSON.stringify(auditBefore) || await sequences(pg)!==auditSequences) throw new Error('Auditoria alterou o clone.');
    evidence.legacyAuditReadOnly = true;
    if (!report.integrityPassed) throw new Error('LEGACY_INTEGRITY_GATE_BLOCKED: clone exige revisão privada; nenhum dado foi corrigido.');
    console.log('[clone] Inventário WF-18 somente leitura; exceções segregadas, sem fatos/vínculos/estoque fabricados.');
  }
  evidence.success = true;
  evidence.stage = 'completed';
  console.log('[clone] Upgrade, dados/sequências preservados, diff vazio e segundo deploy aprovados.');
} catch (error) {
  evidence.success = false;
  // No detailed exception from the database is exposed: it can contain PII.
  evidence.failure = error.message.includes('Clone revela') ? error.message : 'Etapa falhou; diagnóstico privado requerido.';
  await fs.writeFile(path.join(privateDir, `failure-${runId}.private.log`), error instanceof Error ? error.stack || error.message : 'Erro sem stack', { flag: 'wx' });
  console.error(`[clone] ${evidence.failure}`);
  process.exitCode = 1;
} finally {
  evidence.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(privateDir, reuse ? `evidence-${runId}.json` : 'evidence.json'), JSON.stringify(evidence, null, 2), { flag: 'wx' });
  key.fill(0);
  if (restored) await restored.dispose();
  if (pg) await pg.dispose();
  console.log(`[clone] Evidência privada e backups criptografados: ${privateDir}`);
}
