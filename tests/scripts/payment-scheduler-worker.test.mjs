import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../../scripts/homologation/payment-scheduler.worker.mjs';

const ORIGIN = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
const status = () => ({ schemaVersion: 1, accountScope: 'sandbox-hml', inbox: [], outbox: [], operations: [],
  uncertain: 0, overdue: 0, abandonedLeases: 0, untrackedLegacyOrders: 0 });
const summary = () => ({ inbox: { claimed: 0, completed: 0, retried: 0, review: 0 },
  reconciliation: { claimed: 0, completed: 0, retried: 0, review: 0 },
  outbox: { claimed: 0, completed: 0, retried: 0, review: 0 },
  expiration: { success: true, processedCount: 0, cancelledCount: 0, errorCount: 0, executionTimeMs: 1,
    cancelledOrderIds: ['DO_NOT_LOG_CUSTOMER_ID'], errors: ['DO_NOT_LOG_CUSTOMER_DATA'] } });
const env = () => ({ HML_SCHEDULER_ENABLED: 'true', HML_SCHEDULER_MODE: 'status',
  HML_RUN_UNTIL_UTC: new Date(Date.now() + 2 * 3600000).toISOString(),
  CRON_SECRET: 'DO_NOT_LOG_CRON_SECRET', VERCEL_BYPASS_SECRET: 'DO_NOT_LOG_BYPASS_SECRET' });

async function harness(t, config, responses = []) {
  const calls = [];
  const logs = [];
  t.mock.method(console, 'log', value => logs.push(JSON.parse(value)));
  t.mock.method(console, 'error', value => logs.push(JSON.parse(value)));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    assert.ok(next, 'No unexpected external request');
    return next instanceof Response ? next : Response.json(next);
  });
  const run = () => worker.scheduled({ scheduledTime: Date.now() - 60000 }, config);
  return { run, calls, logs };
}

test('disabled and expired jobs make no external requests, even with an older scheduled time', async t => {
  const h = await harness(t, { ...env(), HML_SCHEDULER_ENABLED: 'false' });
  assert.equal((await h.run()).state, 'disabled');
  assert.equal((await worker.scheduled({ scheduledTime: 0 }, { ...env(), HML_RUN_UNTIL_UTC: new Date(0).toISOString() })).state, 'expired');
  assert.equal(h.calls.length, 0);
});

test('invalid configuration fails before contacting the storefront', async t => {
  const cases = [
    [{ HML_SCHEDULER_MODE: 'production' }, 'INVALID_MODE'],
    [{ HML_SCHEDULER_ENABLED: 'yes' }, 'INVALID_ENABLED_FLAG'],
    [{ HML_RUN_UNTIL_UTC: '' }, 'INVALID_DEADLINE'],
    [{ HML_RUN_UNTIL_UTC: new Date(Date.now() + 48 * 3600000).toISOString() }, 'WINDOW_EXCEEDS_24H'],
    [{ CRON_SECRET: '' }, 'MISSING_OR_INVALID_SECRET'],
    [{ VERCEL_BYPASS_SECRET: 'bad\nheader' }, 'MISSING_OR_INVALID_SECRET'],
  ];
  const h = await harness(t, env());
  for (const [override, code] of cases) {
    await assert.rejects(worker.scheduled({}, { ...env(), ...override }), { message: code });
  }
  assert.equal(h.calls.length, 0);
});

test('status mode only reads the fixed Preview with secrets in headers and no redirects', async t => {
  const config = env();
  const h = await harness(t, config, [status()]);
  const result = await h.run();
  assert.equal(result.state, 'status_checked');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, ORIGIN + '/api/cron/payments/status');
  assert.equal(h.calls[0].options.method, 'GET');
  assert.equal(h.calls[0].options.redirect, 'manual');
  assert.equal(h.calls[0].options.headers.Authorization, 'Bearer ' + config.CRON_SECRET);
  assert.equal(h.calls[0].options.headers['x-vercel-protection-bypass'], config.VERCEL_BYPASS_SECRET);
  assert.equal(h.calls[0].options.signal.aborted, false);
  assert.doesNotMatch(JSON.stringify(h.logs), /DO_NOT_LOG/);
});

test('scope mismatch prevents processing', async t => {
  const h = await harness(t, { ...env(), HML_SCHEDULER_MODE: 'process' }, [{ ...status(), accountScope: 'primary' }]);
  await assert.rejects(h.run(), { message: 'UNEXPECTED_SCOPE' });
  assert.equal(h.calls.length, 1);
});

test('redirect, HTML, invalid JSON, HTTP errors and network errors never become successful runs', async t => {
  const h = await harness(t, env(), [
    new Response(null, { status: 302, headers: { Location: 'https://example.com/DO_NOT_LOG' } }),
    new Response('DO_NOT_LOG', { headers: { 'Content-Type': 'text/html' } }),
    new Response('{DO_NOT_LOG', { headers: { 'Content-Type': 'application/json' } }),
    Response.json({ error: 'DO_NOT_LOG' }, { status: 503 }),
    new Error('DO_NOT_LOG_CRON_SECRET'),
  ]);
  for (const code of ['HTTP_302', 'NON_JSON_RESPONSE', 'INVALID_JSON', 'HTTP_503', 'REQUEST_FAILED']) {
    await assert.rejects(h.run(), { message: code });
  }
  assert.doesNotMatch(JSON.stringify(h.logs), /DO_NOT_LOG/);
});

test('legacy pending orders prevent processing', async t => {
  const h = await harness(t, { ...env(), HML_SCHEDULER_MODE: 'process' }, [{ ...status(), untrackedLegacyOrders: 1 }]);
  await assert.rejects(h.run(), { message: 'LEGACY_ORDERS_REQUIRE_REVIEW' });
  assert.equal(h.calls.length, 1);
});

test('processing uses one POST with limit 1 and records only aggregate results', async t => {
  const h = await harness(t, { ...env(), HML_SCHEDULER_MODE: 'process' }, [status(), summary()]);
  const result = await h.run();
  assert.equal(result.state, 'processed');
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].url, ORIGIN + '/api/cron/payments?limit=1');
  assert.equal(h.calls[1].options.method, 'POST');
  assert.doesNotMatch(JSON.stringify(h.logs), /DO_NOT_LOG/);
});

test('a partial HTTP 200 result is reported as requiring review', async t => {
  const partial = summary();
  partial.outbox.retried = 1;
  const h = await harness(t, { ...env(), HML_SCHEDULER_MODE: 'process' }, [status(), partial]);
  await assert.rejects(h.run(), { message: 'PROCESSING_REQUIRES_REVIEW' });
  assert.ok(h.logs.some(log => log.state === 'attention_required' && log.summary.outbox.retried === 1));
  assert.equal(h.calls.length, 2, 'No blind processing retry');
});

test('expiration failures in HTTP 200 are also reported as requiring review', async t => {
  const partial = summary();
  partial.expiration.success = false;
  const h = await harness(t, { ...env(), HML_SCHEDULER_MODE: 'process' }, [status(), partial]);
  await assert.rejects(h.run(), { message: 'PROCESSING_REQUIRES_REVIEW' });
});

test('malformed counters cannot produce successful or sensitive log entries', async t => {
  const invalid = status();
  invalid.inbox = [{ status: 'DO_NOT_LOG_CUSTOMER_DATA', _count: 'DO_NOT_LOG' }];
  const h = await harness(t, env(), [invalid]);
  await assert.rejects(h.run(), { message: 'INVALID_RESPONSE' });
  assert.doesNotMatch(JSON.stringify(h.logs), /DO_NOT_LOG/);
});

test('the public Worker URL cannot invoke processing', async () => {
  assert.equal((await worker.fetch()).status, 404);
});

test('status timeout aborts the request without attempting processing', async t => {
  const h = await harness(t, { ...env(), HML_SCHEDULER_MODE: 'process' });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    h.calls.push({ options });
    options.signal.addEventListener('abort', () => reject(new Error('DO_NOT_LOG_TIMEOUT')), { once: true });
  }));
  const run = h.run();
  const rejected = assert.rejects(run, { message: 'REQUEST_TIMEOUT' });
  t.mock.timers.tick(60000);
  await rejected;
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.signal.aborted, true);
  assert.doesNotMatch(JSON.stringify(h.logs), /DO_NOT_LOG/);
});

test('processing cannot start if the window expires while reading status', async t => {
  const config = { ...env(), HML_SCHEDULER_MODE: 'process' };
  const h = await harness(t, config);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    h.calls.push({ url, options });
    t.mock.method(Date, 'now', () => Date.parse(config.HML_RUN_UNTIL_UTC) + 1);
    return Response.json(status());
  });
  assert.equal((await h.run()).state, 'expired');
  assert.equal(h.calls.length, 1);
});

test('the deployment configuration starts disabled, with no cron and complete logging', async () => {
  const config = JSON.parse(await readFile(new URL('../../scripts/homologation/wrangler.json', import.meta.url), 'utf8'));
  assert.equal(config.vars.HML_SCHEDULER_ENABLED, 'false');
  assert.equal(config.vars.HML_SCHEDULER_MODE, 'status');
  assert.deepEqual(config.triggers.crons, []);
  assert.deepEqual(config.observability, { enabled: true, head_sampling_rate: 1 });
  assert.ok(!('CRON_SECRET' in config.vars));
  assert.ok(!('VERCEL_BYPASS_SECRET' in config.vars));
});
