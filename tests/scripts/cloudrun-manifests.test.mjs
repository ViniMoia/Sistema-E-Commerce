import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cloudRunManifests } from '../../scripts/render-cloudrun.mjs';
const config = JSON.parse(await readFile(new URL('../../infra/cloudrun/config.example.json', import.meta.url), 'utf8'));
test('separates public storefront IAM from private job invocation and app authentication', () => {
  const manifests = cloudRunManifests(config);
  assert.deepEqual(manifests['web-invoker-policy.json'].bindings[0].members, ['allUsers']);
  assert.ok(!JSON.stringify(manifests['payments-invoker-policy.json']).includes('allUsers'));
  const scheduler = manifests['payments-scheduler.json'];
  assert.match(scheduler.httpTarget.uri, /run.googleapis.com\/v2\/.*:run$/);
  assert.ok(scheduler.httpTarget.oauthToken); assert.ok(!scheduler.httpTarget.headers);
  const task = manifests['payments-job.json'].spec.template.spec.template.spec;
  assert.equal(task.maxRetries, 0);
  assert.equal(task.containers[0].env.find(x => x.name === 'CRON_SECRET').value, undefined);
  assert.ok(task.containers[0].env.find(x => x.name === 'CRON_SECRET').valueFrom);
});
test('uses one immutable artifact, bounded instances and explicit disabled remote flags', () => {
  const m = cloudRunManifests(config), spec = m['service.json'].spec.template.spec;
  assert.equal(spec.containers[0].image, config.image);
  assert.equal(spec.containers[0].env.find(x => x.name === 'PAYMENT_REMOTE_ENABLED').value, 'false');
  assert.equal(spec.containers[0].env.find(x => x.name === 'CHECKOUT_PAUSED').value, 'true');
  assert.equal(spec.containers[0].env.find(x => x.name === 'APP_MAINTENANCE_MODE').value, 'false');
  // Section 70: external Nuvemshop images; no storage provisioning for uploads.
  assert.ok(!spec.containers[0].env.some(x => ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ENABLE_DIRECT_UPLOAD'].includes(x.name)));
  assert.equal(m['readiness.json'].productionReady, false);
  assert.equal(m['readiness.json'].schedulesApproved, false);
  assert.ok(m['loyalty-heartbeat-alert.json']);
  assert.ok(m['payments-failure-alert.json']);
});
test('refuses mutable images, missing notification recipients and origin injection', () => {
  assert.throws(() => cloudRunManifests({ ...config, image: 'image:latest' }));
  assert.throws(() => cloudRunManifests({ ...config, notificationChannels: [] }));
  assert.throws(() => cloudRunManifests({ ...config, origin: 'https://user:password@host.example/' }));
});


test('independent supervision job uses the existing secret and bounded alerts without financial activation', () => {
  const m = cloudRunManifests(config);
  const task = m['supervision-job.json'].spec.template.spec.template.spec;
  assert.equal(task.maxRetries, 0);
  assert.equal(task.containers[0].env.find(e => e.name === 'CONSUMER_MODE').value, 'supervision');
  assert.ok(!JSON.stringify(task).includes('DATABASE_URL'));
  const alert = m['supervision-failure-alert.json'];
  assert.deepEqual(alert.notificationChannels, config.notificationChannels);
  assert.equal(alert.alertStrategy.notificationRateLimit.period, '300s');
  assert.match(alert.documentation.content, /nao comprova resolucao financeira/);
  assert.ok(alert.conditions[0].conditionMatchedLog.filter.includes('resource.labels.location="' + config.region + '"'));
  assert.equal(m['supervision-heartbeat-alert.json'].conditions[0].conditionAbsent.duration, '600s');
  assert.equal(m['readiness.json'].resourcesProvisioned, false);
  for (const mode of ['payments', 'loyalty', 'supervision']) {
    const filter = m[`${mode}-failure-alert.json`].conditions[0].conditionMatchedLog.filter;
    // Cloud Run promotes structured severity to LogEntry.severity on ingestion.
    assert.ok(filter.includes('severity>=ERROR OR jsonPayload.severity="ERROR"'));
    assert.ok(filter.includes('jsonPayload.outcome="attention"'));
  }
});
