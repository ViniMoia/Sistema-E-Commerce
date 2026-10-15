// Opening rehearsal for the explicitly classified test dataset, disposable clone only.
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { command } from './disposable-postgres.mjs';
import { assertSmokeTarget } from './restored-application-smoke.mjs';

const store = '536bfa58-0531-49e8-9209-3a046281e516';
const policyVersion = 'legacy-test-opening-v1';
const prefix = 'opening:test-data-v1:';
const json = value => JSON.parse(JSON.stringify(value));

export function validateOpeningBaseline(wallets, transactions, lots) {
  if (wallets.length !== 2 || transactions.length !== 2 || lots !== 0 ||
    wallets.map(w => w.balance).sort((a,b) => a-b).join(',') !== '0,475' ||
    wallets.some(w => w.lojaID !== store || w.accountingReady || w.pending !== 0 || w.debt !== 0 || w.expirationLeaseOwner || w.expirationLeaseUntil) ||
    transactions.some(t => t.lojaID !== store || t.availableDelta !== null || t.debtDelta !== null || t.debtAfter !== null || t.effectKey !== null ||
      !wallets.some(w => w.userID === t.userID)) ||
    wallets.some(w => transactions.filter(t => t.userID === w.userID).reduce((sum,t) => sum+t.points,0) !== w.balance)) {
    throw new Error('OPENING_BASELINE_CHANGED');
  }
}

export async function rehearseLegacyOpening(pg) {
  assertSmokeTarget(pg);
  const label = await command('docker', ['inspect', '--format', '{{index .Config.Labels "logic-audit.run-id"}}', pg.name], { capture:true });
  if (label !== pg.runId) throw new Error('OPENING_CLONE_LABEL_MISMATCH');
  const db = new PrismaClient({ datasources: { db: { url: pg.env.TEST_DATABASE_URL } } });
  try {
    return await db.$transaction(async tx => {
      // Lock before rereading/validating. No shared datasource is accepted above.
      await tx.$queryRaw`SELECT id FROM "LoyaltyWallet" WHERE "lojaID"=${store} ORDER BY id FOR UPDATE`;
      const wallets = await tx.loyaltyWallet.findMany({ where:{ lojaID:store }, orderBy:{id:'asc'} });
      const transactions = await tx.loyaltyTransaction.findMany({ where:{lojaID:store}, orderBy:{id:'asc'} });
      const markers = transactions.filter(t => t.effectKey?.startsWith(prefix));
      const lots = await tx.loyaltyLot.count();
      if (markers.length) {
        if (wallets.length !== 2 || markers.length !== 2 || transactions.length !== 4 || lots !== 0 ||
          wallets.some(w => !w.accountingReady || w.balance || w.pending || w.debt || w.lifetimeEarn ||
            !markers.some(t => t.effectKey === prefix+w.id && t.userID === w.userID && t.policy?.version === policyVersion)) ||
          await tx.auditLog.count({where:{effectKey:{startsWith:prefix}}}) !== 2) throw new Error('OPENING_REPLAY_CONFLICT');
        return { replay:true, wallets:2, balance:0, adjustments:2 };
      }
      validateOpeningBaseline(wallets, transactions, lots);
      const beforeOrders = await tx.order.findMany({ where:{lojaID:store}, include:{items:true},orderBy:{id:'asc'} });
      if (beforeOrders.length !== 24 || beforeOrders.some(o=>o.checkoutIntentID !== null) || await tx.paymentAttempt.count() !== 0) throw new Error('OPENING_ORDER_BASELINE_CHANGED');
      const beforeOtherTables = await tx.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('LoyaltyWallet','LoyaltyTransaction','AuditLog') ORDER BY tablename`);
      async function fingerprints() {
        const result=[];
        for(const {tablename} of beforeOtherTables) {
          const name='"'+tablename.replaceAll('"','""')+'"';
          result.push(await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),'')) AS hash FROM ${name} t`));
        }
        return JSON.stringify(result);
      }
      const before = await fingerprints();
      for (const w of wallets) {
        const previous = json(w);
        const hash = createHash('sha256').update(JSON.stringify({version:policyVersion,previous})).digest('hex');
        // A legacy-segment adjustment offsets test points, without inventing
        // lot origins or misrepresenting the adjustment as an order refund.
        // Modern available/debt deltas start at zero and remain zero here.
        const adjustment = await tx.loyaltyTransaction.create({data:{
          id:randomUUID(),lojaID:store,userID:w.userID,type:'ADMIN_ADJUSTMENT',points:-w.balance,balanceAfter:0,
          effectKey:prefix+w.id,contentHash:hash,
          description:'Encerramento de pontos de teste para abertura; ensaio em clone',
          policy:{version:policyVersion,reason:'USER_CLASSIFIED_TEST_DATA',segment:'legacy-test',previous,
            openingBalance:0,openingModernLedger:0},
        }});
        const after = await tx.loyaltyWallet.update({where:{id:w.id},data:{balance:0,pending:0,debt:0,lifetimeEarn:0,accountingReady:true,version:{increment:1}}});
        await tx.auditLog.create({data:{action:'TEST_DATA_OPENING_REHEARSAL',actorType:'SYSTEM',systemActor:'CLONE_OPENING_REHEARSAL',
          entity:'LoyaltyWallet',entityId:w.id,effectKey:prefix+w.id,previousValue:previous,newValue:json(after),
          metadata:{lojaID:store,cloneOnly:true,adjustmentId:adjustment.id,policyVersion}}});
      }
      const originalAgain = await tx.loyaltyTransaction.findMany({where:{id:{in:transactions.map(t=>t.id)}},orderBy:{id:'asc'}});
      if (JSON.stringify(originalAgain)!==JSON.stringify(transactions) || before!==await fingerprints()) throw new Error('OPENING_HISTORY_CHANGED');
      return {replay:false,wallets:2,removedTestPoints:475,balance:0,adjustments:2,auditRecords:2,
        originalTransactionsPreserved:2,legacyOrdersPreserved:24,otherTablesPreserved:true,
        lotsFabricated:0,remoteCalls:0,cloneOnly:true,productionReady:false};
    }, {timeout:60000,isolationLevel:'Serializable'});
  } finally { await db.$disconnect(); }
}
