import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSmokeTarget } from '../../scripts/lib/restored-application-smoke.mjs';
import { classifyUnlinkedItems } from '../../scripts/lib/restored-legacy-treatment.mjs';
import { testProducts, preservedVacuums, validateTestProducts } from '../../scripts/lib/restored-test-products.mjs';
import { validateOpeningBaseline } from '../../scripts/lib/restored-opening.mjs';
import { assertReportingBaseline } from '../../scripts/lib/restored-order-reporting.mjs';

test('reporting classification requires the exact reviewed backup and complete order fingerprint', () => {
  const backup = '51f0d8d7f80fb9910114928450753e46cfd86ac571e9acdd711d745fda1a65f9';
  const orders = '1d381f7497ca8ac5b9f3fbd7d82f47d1';
  assert.doesNotThrow(() => assertReportingBaseline(backup, 24, orders));
  assert.throws(() => assertReportingBaseline('another-backup', 24, orders));
  assert.throws(() => assertReportingBaseline(backup, 25, orders));
  assert.throws(() => assertReportingBaseline(backup, 24, 'changed-orders'));
});

const runId = '1'.repeat(32);
test('opening refuses real activity, unexplained balances and pending obligations', () => {
  const lojaID='536bfa58-0531-49e8-9209-3a046281e516';
  const wallets=[0,475].map((balance,i)=>({lojaID,userID:String(i),balance,pending:0,debt:0,accountingReady:false}));
  const tx=[200,275].map(points=>({lojaID,userID:'1',points,availableDelta:null,debtDelta:null,debtAfter:null,effectKey:null}));
  assert.doesNotThrow(()=>validateOpeningBaseline(wallets,tx,0));
  assert.throws(()=>validateOpeningBaseline(wallets,tx,1));
  const changed=structuredClone(wallets);changed[1].pending=1;
  assert.throws(()=>validateOpeningBaseline(changed,tx,0));
  changed[1].pending=0;changed[1].balance=500;
  assert.throws(()=>validateOpeningBaseline(changed,tx,0));
  const modern=structuredClone(tx);modern[0].availableDelta=200;
  assert.throws(()=>validateOpeningBaseline(wallets,modern,0));
});
test('retirement pins exact source IDs and rejects homologation lookalike', () => {
  const rows = testProducts.map(p => ({ ...p, lojaID: '536bfa58-0531-49e8-9209-3a046281e516', retiredAt: null, retiredVariants: 0 }));
  assert.doesNotThrow(() => validateTestProducts(rows));
  const wrong = structuredClone(rows); wrong[0].id = 'a26fdbc1-d8c3-4173-b114-f759654b9ca4';
  assert.throws(() => validateTestProducts(wrong));
  const image = structuredClone(rows); image[0].imageUrl = 'https://example.invalid/other.jpg';
  assert.throws(() => validateTestProducts(image));
  assert.throws(() => validateTestProducts(rows.slice(1)));
  assert.equal(testProducts.some(p => preservedVacuums.includes(p.id)), false);
});
function fixture(host = '127.0.0.1') {
  const url = `postgresql://ecommerce_test:fixture@${host}:5432/ecommerce_test_${runId}?schema=public`;
  return { runId, name: `logic-audit-pg-${runId}`, database: `ecommerce_test_${runId}`,
    env: { TEST_RUN_ID: runId, TEST_DATABASE_URL: url, DATABASE_URL: url, DIRECT_URL: url } };
}
test('smoke refuses shared hosts, mismatched identities and alternative datasource', () => {
  assert.doesNotThrow(() => assertSmokeTarget(fixture()));
  assert.throws(() => assertSmokeTarget(fixture('remote.invalid')));
  const wrong = fixture(); wrong.runId = '2'.repeat(32); assert.throws(() => assertSmokeTarget(wrong));
  const switched = fixture(); switched.env.DIRECT_URL = 'postgresql://remote.invalid/db';
  assert.throws(() => assertSmokeTarget(switched));
  const query = fixture(); for (const key of ['TEST_DATABASE_URL','DATABASE_URL','DIRECT_URL']) query.env[key] += '&host=remote.invalid';
  assert.throws(() => assertSmokeTarget(query));
});
test('missing dimensions remain unknown; normalized match never authorizes a repair', async () => {
  const variants = [{ product: 'a', size: 'Unico', color: 'Padrao' },
    { product: 'b', size: 'P', color: 'Azul' }, { product: 'b', size: 'G', color: 'Azul' }];
  const items = [{ product: null, size: null, color: null },
    { product: 'missing', size: null, color: null },
    { product: 'b', size: null, color: 'Azul' },
    { product: 'a', size: null, color: null },
    { product: 'a', size: ' DEFAULT ', color: ' default ' }];
  const before = JSON.stringify({ items, variants });
  assert.deepEqual(await classifyUnlinkedItems(items, variants), { missingProduct: 1,
    noCompatibleVariant: 1, multipleCandidates: 1, singleCandidateIncompleteDimensions: 1, singleCandidateWithDimensions: 1 });
  assert.equal(JSON.stringify({ items, variants }), before);
});
