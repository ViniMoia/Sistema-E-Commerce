type MetricName =
  | 'checkout_requests_total'
  | 'webhook_events_total'
  | 'cron_runs_total'
  | 'email_provider_requests_total'
  | 'readiness_checks_total'
  | 'payment_reconciliation_attempts_total'
  | 'refund_requests_total'
  | 'refund_reconciliation_attempts_total'

const ALLOWED_LABELS: Record<MetricName, ReadonlySet<string>> = {
  checkout_requests_total: new Set(['result', 'payment_method']),
  webhook_events_total: new Set(['result', 'event_type']),
  cron_runs_total: new Set(['job', 'result']),
  email_provider_requests_total: new Set(['provider', 'result']),
  readiness_checks_total: new Set(['result']),
  payment_reconciliation_attempts_total: new Set(['result']),
  refund_requests_total: new Set(['result']),
  refund_reconciliation_attempts_total: new Set(['result']),
}

declare global {
  var applicationMetrics: Map<string, number> | undefined
}

const counters = globalThis.applicationMetrics ?? new Map<string, number>()
globalThis.applicationMetrics = counters

function metricKey(name: MetricName, labels: Record<string, string>): string {
  const allowed = ALLOWED_LABELS[name]
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))
  for (const [key, value] of entries) {
    if (!allowed.has(key)) throw new Error('METRIC_LABEL_NOT_ALLOWED')
    if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(value)) throw new Error('METRIC_LABEL_VALUE_INVALID')
  }
  return JSON.stringify([name, entries])
}

export function incrementMetric(
  name: MetricName,
  labels: Record<string, string>,
  amount = 1
): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('METRIC_AMOUNT_INVALID')
  const key = metricKey(name, labels)
  counters.set(key, (counters.get(key) || 0) + amount)
}

export function renderPrometheusMetrics(): string {
  const lines = [
    '# Application counters are process-local; aggregate across replicas in the collector.',
  ]
  for (const [key, value] of [...counters.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [name, entries] = JSON.parse(key) as [MetricName, Array<[string, string]>]
    const labels = entries.length
      ? `{${entries.map(([label, labelValue]) => `${label}="${labelValue}"`).join(',')}}`
      : ''
    lines.push(`${name}${labels} ${value}`)
  }
  return `${lines.join('\n')}\n`
}

export function resetMetricsForTests(): void {
  if (process.env.NODE_ENV === 'test') counters.clear()
}
