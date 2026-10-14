import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const count = value => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('CONSUMER_RESPONSE_INVALID');
  return value;
};
export function consumerConfig(env) {
  let origin;
  try { origin = new URL(env.CONSUMER_ORIGIN); } catch { throw new Error('CONSUMER_ORIGIN_INVALID'); }
  const local = env.CONSUMER_ALLOW_LOCAL === 'true' && env.PAYMENT_DEPLOYMENT_ENVIRONMENT === 'SANDBOX'
    && ['127.0.0.1', 'localhost'].includes(origin.hostname);
  if ((origin.protocol !== 'https:' && !(local && origin.protocol === 'http:'))
    || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('CONSUMER_ORIGIN_INVALID');
  if (!['SANDBOX', 'PRODUCTION'].includes(env.PAYMENT_DEPLOYMENT_ENVIRONMENT)
    || !/^[a-zA-Z0-9_-]{1,24}$/.test(env.ASAAS_ACCOUNT_SCOPE ?? '')
    || (env.CRON_SECRET?.length ?? 0) < 32) throw new Error('CONSUMER_CONFIGURATION_INVALID');
  const mode = env.CONSUMER_MODE ?? 'payments';
  const batches = Number(env.CONSUMER_MAX_BATCHES ?? 5);
  const timeoutMs = Number(env.CONSUMER_REQUEST_TIMEOUT_MS ?? 240000);
  const backlogSeconds = Number(env.CONSUMER_BACKLOG_WARNING_SECONDS ?? 300);
  if (!['payments', 'loyalty'].includes(mode) || !Number.isInteger(batches) || batches < 1 || batches > 10
    || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300000
    || !Number.isInteger(backlogSeconds) || backlogSeconds < 60) throw new Error('CONSUMER_CONFIGURATION_INVALID');
  return { origin: origin.origin, mode, batches, timeoutMs, backlogSeconds,
    scope: env.ASAAS_ACCOUNT_SCOPE, secret: env.CRON_SECRET };
}

/** One bounded execution. Durable retries remain in the application's leases and
 * queues. Never repeat a timed-out POST here or infer payment from HTTP success. */
export async function runConsumer(env, { fetcher = fetch, log = entry => console.log(JSON.stringify(entry)), now = Date.now } = {}) {
  const config = consumerConfig(env);
  const runId = randomUUID(), started = now();
  const emit = (event, data = {}) => log({ event, runId, mode: config.mode, accountScope: config.scope,
    at: new Date(now()).toISOString(), ...data });
  const request = async (pathname, method = 'GET') => {
    let response;
    try {
      response = await fetcher(config.origin + pathname, { method, redirect: 'error', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + config.secret }, signal: AbortSignal.timeout(config.timeoutMs) });
    } catch { throw new Error('CONSUMER_TRANSPORT_UNCERTAIN'); }
    if (!response.ok) throw new Error('CONSUMER_HTTP_' + response.status);
    try { return await response.json(); } catch { throw new Error('CONSUMER_RESPONSE_INVALID'); }
  };
  const status = async () => {
    const data = await request('/api/cron/payments/status');
    if (data.schemaVersion !== 1 || data.accountScope !== config.scope) throw new Error('CONSUMER_SCOPE_MISMATCH');
    const oldest = data.oldestUnresolvedInboxAt === null ? null : Date.parse(data.oldestUnresolvedInboxAt);
    if (oldest !== null && !Number.isFinite(oldest)) throw new Error('CONSUMER_RESPONSE_INVALID');
    const summarizeGroups = groups => {
      if (!Array.isArray(groups)) throw new Error('CONSUMER_RESPONSE_INVALID');
      return groups.reduce((total, group) => total + (group.status === 'DEAD_LETTER' ? count(group._count) : 0), 0);
    };
    return { uncertain: count(data.uncertain), overdue: count(data.overdue), abandonedLeases: count(data.abandonedLeases),
      reviews: summarizeGroups(data.inbox) + summarizeGroups(data.outbox),
      oldestInboxAgeSeconds: oldest === null ? 0 : Math.max(0, Math.floor((now() - oldest) / 1000)) };
  };
  emit('consumer_started');
  try {
    await status(); // Authenticate and verify account identity before any mutation.
    let claimed = 0, completed = 0, retried = 0, review = 0, expirationErrors = 0, expiredOrders = 0, expirationCandidates = 0, batches = 0;
    if (config.mode === 'loyalty') {
      const data = await request('/api/cron/loyalty-expiration', 'POST');
      if (data.success !== true || !Array.isArray(data.errors) || data.errors.length) throw new Error('CONSUMER_LOYALTY_INCOMPLETE');
      completed = count(data.expiredCount); claimed = count(data.processedWallets);
      review = count(data.skippedLegacyWallets ?? 0); batches = 1;
    } else {
      for (; batches < config.batches;) {
        const data = await request('/api/cron/payments?limit=5', 'POST');
        let batchClaimed = 0;
        for (const name of ['inbox', 'reconciliation', 'outbox']) {
          const part = data[name];
          if (!part) throw new Error('CONSUMER_RESPONSE_INVALID');
          batchClaimed += count(part.claimed); completed += count(part.completed);
          retried += count(part.retried); review += count(part.review);
        }
        if (!data.expiration || typeof data.expiration.success !== 'boolean') throw new Error('CONSUMER_RESPONSE_INVALID');
        expirationErrors += count(data.expiration.errorCount);
        const cancelled = count(data.expiration.cancelledCount);
        expiredOrders += cancelled;
        expirationCandidates += count(data.expiration.processedCount);
        if (!data.expiration.success && !data.expiration.errorCount) throw new Error('CONSUMER_RESPONSE_INVALID');
        claimed += batchClaimed; batches++;
        // A dry-run counts candidates too; only confirmed cancellations are
        // progress. Pending remote cancellation resumes on the next execution.
        if (!batchClaimed && !cancelled) break;
      }
    }
    const backlog = await status();
    const needsAttention = retried > 0 || review > 0 || expirationErrors > 0 || backlog.reviews > 0
      || backlog.overdue > 0 || backlog.abandonedLeases > 0 || backlog.oldestInboxAgeSeconds >= config.backlogSeconds
      || (claimed > 0 && completed === 0);
    const result = { batches, claimed, completed, retried, review, expirationErrors, expiredOrders, expirationCandidates, ...backlog,
      outcome: needsAttention ? 'attention' : (completed || expiredOrders) ? 'progress' : 'idle', durationMs: now() - started };
    emit('consumer_completed', { severity: needsAttention ? 'WARNING' : 'INFO', ...result });
    return result;
  } catch (error) {
    const code = error instanceof Error && /^CONSUMER_[A-Z0-9_]+$/.test(error.message) ? error.message : 'CONSUMER_FAILED';
    emit('consumer_failed', { severity: 'ERROR', code, durationMs: now() - started });
    throw new Error(code);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runConsumer(process.env).catch(() => {
    console.error(JSON.stringify({ severity: 'ERROR', event: 'consumer_exit_failed' }));
    process.exitCode = 1;
  });
}
