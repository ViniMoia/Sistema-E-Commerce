import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { alertProposals, matchesLogFilter, poolBudget, systemEnvironment, grantSql } from '../../scripts/lib/operational-readiness.mjs';
import { runConsumer } from '../../scripts/cloudrun-consumer.mjs';

const baseline = JSON.parse(await fs.readFile(new URL('../../trabalho_em_dupla/evidencias/V-PROPOSTAS-G6-2026-10-22.json', import.meta.url), 'utf8'));
const proposal = alertProposals(baseline);
const metric = proposal.additions[0].body.filter;
const failure = proposal.additions[2].body.conditions[0].conditionMatchedLog.filter;
const resource = { type: 'cloud_run_job', labels: { project_id: 'continental-511812', location: 'southamerica-east1', job_name: 'continental-hml-payments' } };
const entry = (jsonPayload, extra = {}) => ({ resource, jsonPayload, ...extra });

test('proposed filters distinguish success, attention, failure and recovery; policies remain disabled', () => {
  for (const [name, payload, expectedMetric, expectedFailure] of [
    ['success', { event: 'consumer_completed', outcome: 'progress', severity: 'INFO' }, true, false],
    ['attention', { event: 'consumer_completed', outcome: 'attention', severity: 'WARNING' }, true, true],
    ['failure', { event: 'consumer_failed', severity: 'ERROR' }, false, true],
    ['recovery', { event: 'consumer_completed', outcome: 'idle', severity: 'INFO' }, true, false],
  ]) {
    assert.equal(matchesLogFilter(metric, entry(payload)), expectedMetric, name);
    assert.equal(matchesLogFilter(failure, entry(payload)), expectedFailure, name);
  }
  assert.equal(matchesLogFilter(failure, entry({}, { severity: 'CRITICAL' })), true);
  assert.equal(matchesLogFilter(failure, entry({ outcome: 'idle' })), false);
  for (const addition of proposal.additions.filter(x => x.resource === 'alertPolicy')) assert.equal(addition.body.enabled, false);
  assert.equal(baseline.additions[1].body.conditions[0].conditionAbsent.filter.includes('resource.labels.job_name'), false);
  assert.equal(proposal.additions[1].body.conditions[0].conditionAbsent.duration, '600s');
  assert.equal(proposal.additions[1].body.conditions[0].conditionAbsent.aggregations[0].alignmentPeriod, '600s');
  assert.ok(proposal.additions[1].body.conditions[0].conditionAbsent.filter.includes('resource.labels.job_name="continental-hml-payments"'));
});

test('payment filters reject supervision and other project/region/type even on errors', () => {
  for (const replacement of [{ type: 'cloud_run_revision' }, { labels: { ...resource.labels, project_id: 'other' } },
    { labels: { ...resource.labels, location: 'other' } }, { labels: { ...resource.labels, job_name: 'continental-hml-supervision' } }]) {
    const log = entry({ event: 'consumer_completed', severity: 'ERROR', outcome: 'attention' }, { resource: { ...resource, ...replacement } });
    assert.equal(matchesLogFilter(metric, log), false); assert.equal(matchesLogFilter(failure, log), false);
  }
  assert.throws(() => matchesLogFilter('NOT severity=ERROR', {}), /UNSUPPORTED_FILTER/);
});

test('real supervision consumer emits health, attention, failure and recovery using GET only', async () => {
  const snapshot = { schemaVersion: 1, accountScope: 'primary', uncertain: 0, overdue: 0, abandonedLeases: 0,
    inbox: [], outbox: [], untrackedLegacyOrders: 0, oldestUnresolvedInboxAt: null,
    supervision: { schemaVersion: 1, reviewAttempts: 0, chargebackReviews: 0, physicalReturnReviews: 0,
      heldOperations: 0, emailDeadLetters: 0, expiredQueueLeases: 0, foreignAccountAttempts: 0,
      oldestUnresolvedOutboxAt: null, oldestPendingEmailAt: null, oldestDueReconciliationAt: null } };
  const env = { CONSUMER_ORIGIN: 'https://fixture.invalid', CONSUMER_MODE: 'supervision', CRON_SECRET: 's'.repeat(32),
    PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX', ASAAS_ACCOUNT_SCOPE: 'primary' };
  for (const [name, uncertain, failed] of [['success', 0, false], ['attention', 1, false], ['failure', 0, true], ['recovery', 0, false]]) {
    const calls = [], logs = [];
    const execution = runConsumer(env, { log: log => logs.push(log), fetcher: async (url, options) => {
      calls.push({ url, method: options.method }); if (failed) throw new Error('SYNTHETIC_NETWORK_FAILURE');
      return { ok: true, json: async () => ({ ...snapshot, uncertain }) };
    } });
    if (failed) await assert.rejects(execution, /CONSUMER_TRANSPORT_UNCERTAIN/); else assert.equal((await execution).processingAttempted, false);
    assert.deepEqual(calls, [{ url: 'https://fixture.invalid/api/cron/payments/status', method: 'GET' }]);
    const supervisionLog = { resource: { ...resource, labels: { ...resource.labels, job_name: 'continental-hml-supervision' } }, jsonPayload: logs.at(-1) };
    const supervisionMetric = metric.replaceAll('continental-hml-payments', 'continental-hml-supervision');
    const supervisionFailure = failure.replaceAll('continental-hml-payments', 'continental-hml-supervision');
    assert.equal(matchesLogFilter(supervisionMetric, supervisionLog), !failed, name);
    assert.equal(matchesLogFilter(supervisionFailure, supervisionLog), failed || uncertain > 0, name);
    assert.equal(matchesLogFilter(metric, supervisionLog), false);
  }
});

test('pool arithmetic keeps unknown external consumption visible and cannot approve remote capacity', () => {
  const value = poolBudget(); assert.equal(value.known, 32); assert.equal(value.remainingBeforeExternal, 76);
  assert.equal(value.externalConnections, null); assert.equal(value.approved, false);
  assert.equal(poolBudget({ externalConnections: 100 }).approved, false);
  assert.throws(() => poolBudget({ pool: -1 }));
});

test('child environment drops shared secrets, Node injection and provider endpoints; grants are explicit', () => {
  assert.deepEqual(systemEnvironment({ Path: 'os-path', TEMP: 'os-temp', DATABASE_URL: 'secret', NODE_OPTIONS: '--import unsafe',
    ASAAS_API_KEY: 'secret', ASAAS_BASE_URL: 'https://shared.invalid', HTTP_PROXY: 'unsafe' }), { Path: 'os-path', TEMP: 'os-temp' });
  const sql = grantSql();
  assert.ok(!/GRANT.*ALL TABLES/.test(sql)); assert.ok(!/GRANT.*TRUNCATE/.test(sql));
  assert.ok(!/GRANT.*_prisma_migrations/.test(sql)); assert.ok(sql.includes('UPDATE ("id") ON "Loja"'));
});
