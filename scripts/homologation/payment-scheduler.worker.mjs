// Standalone Cloudflare Worker. Its only destination is the homologation Preview.
const ORIGIN = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

class SchedulerFailure extends Error {}

function fail(code) {
  throw new SchedulerFailure(code);
}

function counts(value, fields) {
  const result = {};
  for (const field of fields) {
    if (!Number.isSafeInteger(value?.[field]) || value[field] < 0) fail('INVALID_RESPONSE');
    result[field] = value[field];
  }
  return result;
}

function backlog(value) {
  if (value?.schemaVersion !== 1 || value.accountScope !== 'sandbox-hml') fail('UNEXPECTED_SCOPE');
  const result = counts(value, ['uncertain', 'overdue', 'abandonedLeases', 'untrackedLegacyOrders']);
  for (const field of ['inbox', 'outbox', 'operations']) {
    if (!Array.isArray(value[field])) fail('INVALID_RESPONSE');
    result[field] = value[field].reduce((total, row) => total + counts(row, ['_count'])._count, 0);
    if (!Number.isSafeInteger(result[field])) fail('INVALID_RESPONSE');
  }
  return result;
}

function processing(value) {
  const result = {};
  for (const field of ['inbox', 'reconciliation', 'outbox']) {
    result[field] = counts(value?.[field], ['claimed', 'completed', 'retried', 'review']);
  }
  result.expiration = counts(value?.expiration, ['processedCount', 'cancelledCount', 'errorCount', 'executionTimeMs']);
  if (typeof value.expiration.success !== 'boolean') fail('INVALID_RESPONSE');
  result.expiration.success = value.expiration.success;
  return result;
}

async function request(env, path, method, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(ORIGIN + path, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Authorization: 'Bearer ' + env.CRON_SECRET,
        'x-vercel-protection-bypass': env.VERCEL_BYPASS_SECRET,
        Accept: 'application/json',
      },
    });
    if (!response.ok) fail('HTTP_' + response.status);
    if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) fail('NON_JSON_RESPONSE');
    // Never log upstream response text, headers, customer records, or secret values.
    try {
      return await response.json();
    } catch {
      fail(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'INVALID_JSON');
    }
  } catch (error) {
    if (error instanceof SchedulerFailure) throw error;
    fail(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'REQUEST_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

const worker = {
  fetch() {
    // Visiting the Worker URL never triggers financial processing.
    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env) {
    const startedAt = Date.now();
    const metadata = {
      startedAt: new Date(startedAt).toISOString(),
      scheduledAt: Number.isFinite(event.scheduledTime) ? new Date(event.scheduledTime).toISOString() : null,
    };
    const log = (state, extra = {}) => {
      const finishedAt = Date.now();
      const entry = { event: 'hml-payment-scheduler', ...metadata, state, ...extra,
        finishedAt: new Date(finishedAt).toISOString(), durationMs: finishedAt - startedAt };
      (state === 'error' ? console.error : console.log)(JSON.stringify(entry));
      return entry;
    };

    try {
      if (env.HML_SCHEDULER_ENABLED === undefined || env.HML_SCHEDULER_ENABLED === 'false') return log('disabled');
      if (env.HML_SCHEDULER_ENABLED !== 'true') fail('INVALID_ENABLED_FLAG');
      const mode = env.HML_SCHEDULER_MODE;
      if (mode !== 'status' && mode !== 'process') fail('INVALID_MODE');
      if (typeof env.HML_RUN_UNTIL_UTC !== 'string' || !env.HML_RUN_UNTIL_UTC.endsWith('Z')) fail('INVALID_DEADLINE');
      const deadline = Date.parse(env.HML_RUN_UNTIL_UTC);
      if (!Number.isFinite(deadline)) fail('INVALID_DEADLINE');
      if (deadline <= startedAt) return log('expired');
      if (deadline - startedAt > MAX_WINDOW_MS) fail('WINDOW_EXCEEDS_24H');
      for (const key of ['CRON_SECRET', 'VERCEL_BYPASS_SECRET']) {
        if (typeof env[key] !== 'string' || !env[key].trim() || /[\r\n]/.test(env[key])) fail('MISSING_OR_INVALID_SECRET');
      }

      log('started', { mode });
      const status = backlog(await request(env, '/api/cron/payments/status', 'GET', 60_000));
      if (mode === 'status') return log('status_checked', { mode, accountScope: 'sandbox-hml', backlog: status });
      if (status.untrackedLegacyOrders > 0) fail('LEGACY_ORDERS_REQUIRE_REVIEW');
      // A delayed status request must not start processing after the test window ends.
      if (Date.now() >= deadline) return log('expired');
      const summary = processing(await request(env, '/api/cron/payments?limit=1', 'POST', 330_000));
      const needsReview = ['inbox', 'reconciliation', 'outbox'].some(field => summary[field].retried > 0 || summary[field].review > 0)
        || !summary.expiration.success || summary.expiration.errorCount > 0;
      if (needsReview) {
        log('attention_required', { mode, summary });
        fail('PROCESSING_REQUIRES_REVIEW');
      }
      return log('processed', { mode, summary });
    } catch (error) {
      const code = error instanceof SchedulerFailure ? error.message : 'SCHEDULER_FAILED';
      log('error', { code });
      // Mark the cron invocation as failed, without exposing the original exception.
      throw new Error(code);
    }
  },
};

export default worker;
