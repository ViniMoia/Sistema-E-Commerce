import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSnapshots, identity } from '../../scripts/homologation/webhook-recovery-baseline.mjs';

function fixture() {
  const keys = ['order', 'items', 'history', 'reservations', 'stock', 'variants', 'wallet',
    'loyaltyTransactions', 'loyaltyLots', 'loyaltyAllocations', 'financialFacts', 'attempts',
    'charges', 'operations', 'outbox', 'inbox', 'protectedBoleto8'];
  return { schemaVersion: 1, readOnly: true, code: 'BASELINE_CAPTURED', identity: { ...identity },
    parts: Object.fromEntries(keys.map(key => [key, { count: 1, hash: 'a'.repeat(32) }])) };
}

test('equal snapshots do not claim provider delivery', () => {
  const result = compareSnapshots(fixture(), fixture());
  assert.equal(result.unchanged, true);
  assert.equal(result.providerRedeliveryVerified, false);
});

test('detects changed balances/content even with identical row counts', () => {
  const after = fixture();
  for (const part of ['stock', 'wallet', 'outbox']) after.parts[part].hash = 'b'.repeat(32);
  assert.deepEqual(compareSnapshots(fixture(), after).changedParts, ['stock', 'wallet', 'outbox']);
});

test('detects an additional event with unchanged prior contents', () => {
  const after = fixture(); after.parts.inbox.count++;
  assert.equal(compareSnapshots(fixture(), after).unchanged, false);
});

for (const [name, corrupt] of [
  ['missing protected order', s => { delete s.parts.protectedBoleto8; }],
  ['wrong account', s => { s.identity.accountScope = 'primary'; }],
  ['unverified read-only', s => { s.readOnly = false; }],
  ['missing content fingerprint', s => { s.parts.wallet.hash = ''; }],
]) test(`rejects ${name} on either side`, () => {
  const invalid = fixture(); corrupt(invalid);
  assert.throws(() => compareSnapshots(invalid, fixture()), /INVALID_COMPARISON_BASELINE/);
  assert.throws(() => compareSnapshots(fixture(), invalid), /INVALID_COMPARISON_BASELINE/);
});
