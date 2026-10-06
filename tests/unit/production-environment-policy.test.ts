import { describe, expect, it } from 'vitest';
import { checkProductionEnvironment } from '../../scripts/lib/production-environment-policy.mjs';
const signing = { FREIGHT_QUOTE_SECRET: 'f'.repeat(32) };
describe('WF-19: configuration approval is distinct from production readiness', () => {
  it('accepts held remote flags without requiring or activating financial credentials', () => {
    expect(checkProductionEnvironment(signing)).toMatchObject({ configurationPassed: true,
      remoteEnabled: false, workerEnabled: false, expirationEnabled: false, productionReady: false, externalCalls: 0, mutations: 0 });
  });
  it('rejects missing signing key and an environment belonging to disposable tests', () => {
    expect(checkProductionEnvironment({ TEST_RUN_ID: 'fixture' }).issues.map(issue => issue.code))
      .toEqual(['TEST_ENVIRONMENT_NOT_A_RELEASE', 'FREIGHT_QUOTE_SECRET_MISSING']);
  });
  it('detects literal dollar expansion without serializing the declared credential', () => {
    const result = checkProductionEnvironment(signing, { nonempty: true, unescapedDollarReference: true });
    expect(result.issues).toMatchObject([{ code: 'ASAAS_KEY_REMOVED_BY_ENV_EXPANSION', severity: 'WARNING' }]);
    expect(result.configurationPassed).toBe(true);
    expect(checkProductionEnvironment({ ...signing, ASAAS_API_KEY: 'unprinted' }, { nonempty: true, unescapedDollarReference: true }).issues).toHaveLength(0);
  });
  it('refuses a sandbox or incomplete remote setup outside an identified Vercel Preview', () => {
    const result = checkProductionEnvironment({ ...signing, PAYMENT_REMOTE_ENABLED: 'true', ASAAS_API_URL: 'https://api-sandbox.asaas.com/v3',
      ASAAS_API_KEY: '$aact_SANDBOX_CANARY' });
    expect(result.configurationPassed).toBe(false);
    expect(result.issues.map(issue => issue.code)).toEqual(['ASAAS_PRODUCTION_CONFIGURATION_MISSING', 'ASAAS_TENANT_ALLOWLIST_MISSING', 'ASAAS_WEBHOOK_TOKEN_MISSING']);
    expect(JSON.stringify(result)).not.toContain('SANDBOX_CANARY');
  });
  it('accepts isolated Sandbox configuration on optimized Vercel Preview without certifying the account', () => {
    const env = { ...signing, VERCEL: '1', VERCEL_ENV: 'preview', PAYMENT_REMOTE_ENABLED: 'true',
      ASAAS_API_URL: 'https://api-sandbox.asaas.com/v3', ASAAS_API_KEY: '$aact_hml_CANARY',
      ASAAS_ENABLED_LOJA_IDS: 'fixture', ASAAS_WEBHOOK_TOKEN: 'CANARY' };
    const result = checkProductionEnvironment(env);
    expect(result).toMatchObject({ configurationPassed: true, expectedGatewayTarget: 'SANDBOX',
      productionReady: false, externalCalls: 0, mutations: 0 });
    expect(JSON.stringify(result)).not.toContain('CANARY');
    expect(checkProductionEnvironment({ ...env, ASAAS_API_URL: 'https://api.asaas.com/v3',
      ASAAS_API_KEY: '$aact_prod_CANARY' }).issues.map(issue => issue.code)).toContain('ASAAS_SANDBOX_CONFIGURATION_MISSING');
  });
  it('accepts a syntactically complete remote configuration without claiming provider or scheduler approval', () => {
    const env = { ...signing, PAYMENT_REMOTE_ENABLED: 'true', ASAAS_API_URL: 'https://api.asaas.com/v3', ASAAS_API_KEY: '$aact_prod_CANARY',
      ASAAS_ENABLED_LOJA_IDS: 'fixture', ASAAS_WEBHOOK_TOKEN: 'CANARY', PAYMENT_WORKER_ENABLED: 'true', CRON_SECRET: 'CANARY' };
    const result = checkProductionEnvironment(env);
    expect(result).toMatchObject({ configurationPassed: true, productionReady: false, externalCalls: 0, mutations: 0 });
    expect(JSON.stringify(result)).not.toContain('CANARY');
    expect(checkProductionEnvironment({ ...env, CRON_SECRET: '' }).issues).toMatchObject([{ code: 'CRON_AUTHENTICATION_MISSING' }]);
  });
});
