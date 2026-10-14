import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumerConfig, runConsumer } from '../../scripts/cloudrun-consumer.mjs';
const env = { CONSUMER_ORIGIN: 'https://shop.example', CRON_SECRET: 's'.repeat(32),
  ASAAS_ACCOUNT_SCOPE: 'sandbox-hml', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX' };
const snapshot = { schemaVersion: 1, accountScope: 'sandbox-hml', uncertain: 0, overdue: 0,
  abandonedLeases: 0, inbox: [], outbox: [], oldestUnresolvedInboxAt: null };
const summary = n => ({ claimed: n, completed: n, retried: 0, review: 0 });
const batch = n => ({ inbox: summary(n), reconciliation: summary(0), outbox: summary(n),
  expiration: { success: true, errorCount: 0, processedCount: 0, cancelledCount: 0 } });
const response = data => ({ ok: true, json: async () => data });

test('verifies identity, sends authenticated POST, stops on idle and records actual progress', async () => {
  const logs = [], calls = []; let drained = false;
  const result = await runConsumer(env, { log: x => logs.push(x), fetcher: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/status')) return response(snapshot);
    const data = batch(drained ? 0 : 2); drained = true; return response(data);
  } });
  assert.equal(result.completed, 4); assert.equal(result.batches, 2); assert.equal(result.outcome, 'progress');
  assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer ' + env.CRON_SECRET);
  assert.ok(calls.every(x => x.options.redirect === 'error'));
  assert.equal(logs.at(-1).event, 'consumer_completed');
  assert.ok(!JSON.stringify(logs).includes(env.CRON_SECRET));
});
test('wrong account blocks POST', async () => {
  let requests = 0;
  await assert.rejects(runConsumer(env, { log() {}, fetcher: async () => { requests++; return response({ ...snapshot, accountScope: 'production' }); } }), /SCOPE_MISMATCH/);
  assert.equal(requests, 1);
});
test('expiration reports confirmed progress, while dry-run candidates do not repeat the same batch', async () => {
  for (const cancelledCount of [0, 2]) {
    let posts = 0;
    const result = await runConsumer(env, { log() {}, fetcher: async url => {
      if (url.endsWith('/status')) return response(snapshot);
      posts++;
      return response(posts === 1 ? { ...batch(0), expiration: {
        success: true, errorCount: 0, processedCount: 2, cancelledCount,
      } } : batch(0));
    } });
    assert.equal(result.expiredOrders, cancelledCount);
    assert.equal(result.outcome, cancelledCount ? 'progress' : 'idle');
    assert.equal(posts, cancelledCount ? 2 : 1);
  }
});
test('uncertain POST is not retried, raw errors/secrets are never logged', async () => {
  let posts = 0; const logs = [];
  await assert.rejects(runConsumer(env, { log: x => logs.push(x), fetcher: async url => {
    if (url.endsWith('/status')) return response(snapshot);
    posts++; throw new Error(env.CRON_SECRET);
  } }), /TRANSPORT_UNCERTAIN/);
  assert.equal(posts, 1); assert.ok(!JSON.stringify(logs).includes(env.CRON_SECRET));
  assert.equal(logs.at(-1).event, 'consumer_failed');
});
test('recovery in a new execution uses existing endpoints, without sending a new payment command', async () => {
  const result = await runConsumer(env, { log() {}, fetcher: async url => response(url.endsWith('/status') ? snapshot : batch(0)) });
  assert.equal(result.outcome, 'idle'); assert.equal(result.completed, 0);
});
test('HTTP 200 with retries/reviews is attention, not healthy progress', async () => {
  const result = await runConsumer({ ...env, CONSUMER_MAX_BATCHES: '1' }, { log() {}, fetcher: async url => {
    if (url.endsWith('/status')) return response({ ...snapshot, outbox: [{ status: 'DEAD_LETTER', _count: 1 }] });
    return response({ ...batch(0), inbox: { claimed: 1, completed: 0, retried: 1, review: 0 } });
  } });
  assert.equal(result.outcome, 'attention'); assert.equal(result.reviews, 1);
});
test('loyalty expiration is separately scheduled and validates partial failure', async () => {
  const calls = [];
  const result = await runConsumer({ ...env, CONSUMER_MODE: 'loyalty' }, { log() {}, fetcher: async url => {
    calls.push(url); return response(url.endsWith('/status') ? snapshot : { success: true, errors: [], expiredCount: 2, processedWallets: 1 });
  } });
  assert.equal(result.completed, 2); assert.ok(calls[1].endsWith('/loyalty-expiration'));
});
test('rejects malformed responses and failed authentication', async () => {
  await assert.rejects(runConsumer(env, { log() {}, fetcher: async () => ({ ok: false, status: 401 }) }), /HTTP_401/);
  await assert.rejects(runConsumer(env, { log() {}, fetcher: async url => response(url.endsWith('/status') ? snapshot : {}) }), /RESPONSE_INVALID/);
});
test('rejects redirects/embedded credentials/path and production loopback bypass', () => {
  for (const origin of ['http://shop.example', 'https://user:pass@shop.example', 'https://shop.example/path', 'https://shop.example?x=1']) {
    assert.throws(() => consumerConfig({ ...env, CONSUMER_ORIGIN: origin }));
  }
  assert.throws(() => consumerConfig({ ...env, PAYMENT_DEPLOYMENT_ENVIRONMENT: 'PRODUCTION', CONSUMER_ORIGIN: 'http://127.0.0.1', CONSUMER_ALLOW_LOCAL: 'true' }));
  assert.throws(() => consumerConfig({ ...env, CONSUMER_MAX_BATCHES: '100' }));
});
