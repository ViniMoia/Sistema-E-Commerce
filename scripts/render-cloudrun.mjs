import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Produces reviewable API manifests only; no gcloud/network/provisioning. */
export function cloudRunManifests(c) {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(c.project ?? '') || !/^[a-z]+-[a-z]+[0-9]$/.test(c.region ?? '')
    || !/^[a-z][a-z0-9-]{0,39}$/.test(c.service ?? '') || !/^\d+$/.test(c.projectNumber ?? '')
    || !/^\d+$/.test(c.secretVersion ?? '') || !['SANDBOX', 'PRODUCTION'].includes(c.environment)
    || !/^[a-zA-Z0-9_-]{1,24}$/.test(c.accountScope ?? '')
    || !/^[a-z0-9.-]+\.pkg\.dev\/[a-z0-9/_-]+@sha256:[a-f0-9]{64}$/.test(c.image ?? '')) throw new Error('CLOUDRUN_CONFIG_INVALID');
  const origin = new URL(c.origin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('CLOUDRUN_ORIGIN_INVALID');
  if (!Array.isArray(c.notificationChannels) || c.notificationChannels.length < 1
    || c.notificationChannels.some(x => !new RegExp('^projects/' + c.project + '/notificationChannels/[a-zA-Z0-9_-]+$').test(x))) throw new Error('CLOUDRUN_NOTIFICATION_CHANNEL_REQUIRED');
  const sa = name => `${c.service}-${name}@${c.project}.iam.gserviceaccount.com`;
  const secret = name => ({ name, valueFrom: { secretKeyRef: { name: `${c.service}-${name.toLowerCase().replaceAll('_', '-')}`, key: c.secretVersion } } });
  const value = (name, val) => ({ name, value: val });
  const common = [value('PAYMENT_DEPLOYMENT_ENVIRONMENT', c.environment), value('ASAAS_ACCOUNT_SCOPE', c.accountScope)];
  const metadata = name => ({ name, namespace: c.projectNumber, labels: { 'cloud.googleapis.com/location': c.region } });
  const artifacts = {};
  artifacts['service.json'] = { apiVersion: 'serving.knative.dev/v1', kind: 'Service', metadata: metadata(c.service), spec: {
    template: { metadata: { annotations: { 'autoscaling.knative.dev/minScale': '0', 'autoscaling.knative.dev/maxScale': '2' } }, spec: {
      serviceAccountName: sa('web'), containerConcurrency: 20, timeoutSeconds: 300,
      containers: [{ image: c.image, ports: [{ containerPort: 8080 }], resources: { limits: { cpu: '1', memory: '1Gi' } },
        startupProbe: { tcpSocket: { port: 8080 }, periodSeconds: 10, failureThreshold: 24 },
        env: [...common, value('NEXT_PUBLIC_APP_URL', origin.origin), value('TRUSTED_PROXY_PROVIDER', ''),
          value('CHECKOUT_PAUSED', 'true'),
          value('APP_MAINTENANCE_MODE', 'false'),
          value('PAYMENT_REMOTE_ENABLED', 'false'), value('PAYMENT_WORKER_ENABLED', 'false'), value('PAYMENT_EXPIRATION_ENABLED', 'false'),
          value('ASAAS_INSTALLMENTS_APPROVED', 'false'), value('INSTALLMENT_MAX_COUNT', '12'), value('INSTALLMENT_ABSORB_FEES', 'false'),
          value('INSTALLMENT_MONTHLY_RATE', '0.0299'), value('INSTALLMENT_MIN_VALUE', '20'),
          value('ASAAS_API_URL', c.environment === 'SANDBOX' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'),
          ...['DATABASE_URL', 'DIRECT_URL', 'SESSION_SECRET', 'FREIGHT_QUOTE_SECRET', 'CRON_SECRET', 'ASAAS_API_KEY',
            'ASAAS_WEBHOOK_TOKEN', 'ASAAS_ENABLED_LOJA_IDS', 'RESEND_API_KEY', 'EMAIL_FROM', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].map(secret)] }],
    } }, traffic: [{ latestRevision: true, percent: 100 }],
  } };
  artifacts['web-invoker-policy.json'] = { bindings: [{ role: 'roles/run.invoker', members: ['allUsers'] }] };
  for (const mode of ['payments', 'loyalty', 'supervision']) {
    const job = `${c.service}-${mode}`;
    artifacts[`${mode}-job.json`] = { apiVersion: 'run.googleapis.com/v1', kind: 'Job', metadata: metadata(job), spec: {
      template: { spec: { parallelism: 1, taskCount: 1, template: { spec: {
        serviceAccountName: sa('consumer'), maxRetries: 0, timeoutSeconds: 1800,
        containers: [{ image: c.image, command: ['node'], args: ['scripts/cloudrun-consumer.mjs'],
          resources: { limits: { cpu: '1', memory: '512Mi' } },
          env: [...common, secret('CRON_SECRET'), value('CONSUMER_ORIGIN', origin.origin), value('CONSUMER_MODE', mode),
            value('CONSUMER_MAX_BATCHES', '5'), value('CONSUMER_REQUEST_TIMEOUT_MS', '240000'), value('CONSUMER_BACKLOG_WARNING_SECONDS', '300')] }],
      } } } },
    } };
    artifacts[`${mode}-invoker-policy.json`] = { bindings: [{ role: 'roles/run.invoker', members: ['serviceAccount:' + sa('scheduler')] }] };
    artifacts[`${mode}-scheduler.json`] = {
      name: `projects/${c.project}/locations/${c.region}/jobs/${job}`,
      schedule: mode === 'loyalty' ? '17 * * * *' : '* * * * *', timeZone: 'Etc/UTC', attemptDeadline: '30s',
      retryConfig: { retryCount: 0 }, httpTarget: { httpMethod: 'POST',
        uri: `https://run.googleapis.com/v2/projects/${c.project}/locations/${c.region}/jobs/${job}:run`,
        oauthToken: { serviceAccountEmail: sa('scheduler'), scope: 'https://www.googleapis.com/auth/cloud-platform' } },
    };
    const filter = `resource.type="cloud_run_job" AND resource.labels.project_id="${c.project}" AND resource.labels.location="${c.region}" AND resource.labels.job_name="${job}"`;
    const metric = `${job}-completed`;
    artifacts[`${mode}-heartbeat-metric.json`] = { name: metric, filter: `${filter} AND jsonPayload.event="consumer_completed"`,
      metricDescriptor: { metricKind: 'DELTA', valueType: 'INT64', unit: '1', displayName: metric } };
    artifacts[`${mode}-heartbeat-alert.json`] = { displayName: `${job}: execução ausente`, enabled: true, combiner: 'OR',
      notificationChannels: c.notificationChannels, conditions: [{ displayName: 'Sem conclusão do consumidor', conditionAbsent: {
        filter: `resource.type="cloud_run_job" AND metric.type="logging.googleapis.com/user/${metric}"`,
        duration: mode === 'loyalty' ? '7200s' : '600s', trigger: { count: 1 },
        aggregations: [{ alignmentPeriod: '60s', perSeriesAligner: 'ALIGN_DELTA', crossSeriesReducer: 'REDUCE_SUM' }],
      } }] };
    artifacts[`${mode}-failure-alert.json`] = { displayName: `${job}: falha ou falta de progresso`, enabled: true, combiner: 'OR',
      documentation: { mimeType: 'text/markdown', content: 'Conferir modo, conta, attentionReasons e contagens do consumer_completed. Consultar os casos pela aplicacao autorizada; nao rearmar operacoes nem limpar revisoes por SQL. Fechamento automatico deste incidente de monitoramento nao comprova resolucao financeira. Registrar responsavel, proxima acao e evidencia do caso.' },
      notificationChannels: c.notificationChannels, alertStrategy: { notificationRateLimit: { period: '300s' }, autoClose: '86400s' },
      conditions: [{ displayName: 'Falha, revisão, retry ou atraso', conditionMatchedLog: {
        filter: `${filter} AND (severity>=ERROR OR jsonPayload.severity="ERROR" OR jsonPayload.outcome="attention")`,
      } }] };
  }
  artifacts['readiness.json'] = { productionReady: false, schedulesApproved: false, resourcesProvisioned: false,
    requiredAccounts: ['web', 'consumer', 'scheduler'].map(sa),
    requiredReview: ['G1-G8', 'Neon compute/pool budget', 'financial deadlines', 'IAM/Secret Manager', 'DNS/TLS/Host', 'Resend/storage', 'notification delivery'],
    warning: 'Schedules are a candidate for measurement, not approved Neon Free operation. Activate only after coordinated acceptance.' };
  return artifacts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [configFile, outputDirectory] = process.argv.slice(2);
  if (!configFile || !outputDirectory || process.argv.length !== 4) throw new Error('Usage: node scripts/render-cloudrun.mjs config.json output-directory');
  const artifacts = cloudRunManifests(JSON.parse(await readFile(configFile, 'utf8')));
  await mkdir(outputDirectory, { recursive: true });
  for (const [name, data] of Object.entries(artifacts)) await writeFile(path.join(outputDirectory, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ manifests: Object.keys(artifacts).length, deployed: false, productionReady: false }));
}
