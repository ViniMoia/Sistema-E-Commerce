import { afterEach, describe, expect, it, vi } from 'vitest';
import { asaasConfigurationReady, asaasGatewayTarget, expectedAsaasEnvironment } from '@/lib/config/asaas-environment.mjs';
import { AsaasClient } from '@/services/asaas/asaas.client';

const sandbox = 'https://api-sandbox.asaas.com/v3';
const production = 'https://api.asaas.com/v3';
const sandboxKey = '$aact_hml_CANARY';
const productionKey = '$aact_prod_CANARY';
const preview = { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview' };
afterEach(() => vi.unstubAllEnvs());

describe('WF-19: Asaas environment follows the deployment context', () => {
  it('allows an explicitly scoped optimized Sandbox outside Vercel and rejects production credentials', () => {
    const env = { NODE_ENV: 'production', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX', ASAAS_ACCOUNT_SCOPE: 'sandbox-hml' };
    expect(expectedAsaasEnvironment(env)).toBe('SANDBOX');
    expect(asaasConfigurationReady(env, sandbox, sandboxKey)).toBe(true);
    expect(asaasConfigurationReady(env, production, productionKey)).toBe(false);
    expect(asaasConfigurationReady(env, sandbox, productionKey)).toBe(false);
  });
  it('accepts explicit production only in an optimized runtime with an explicit account scope', () => {
    const env = { NODE_ENV: 'production', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'PRODUCTION', ASAAS_ACCOUNT_SCOPE: 'store-live' };
    expect(asaasConfigurationReady(env, production, productionKey)).toBe(true);
    expect(asaasConfigurationReady(env, sandbox, sandboxKey)).toBe(false);
    for (const NODE_ENV of ['test', 'development', undefined]) {
      expect(expectedAsaasEnvironment({ ...env, NODE_ENV })).toBe('INVALID');
      expect(asaasConfigurationReady({ ...env, NODE_ENV }, production, productionKey)).toBe(false);
    }
  });
  it.each(['', 'sandbox', 'SANDBOX ', 'preview', 'INVALID'])('fails closed for malformed explicit environment %j', value => {
    const env = { NODE_ENV: 'production', PAYMENT_DEPLOYMENT_ENVIRONMENT: value, ASAAS_ACCOUNT_SCOPE: 'sandbox-hml' };
    expect(expectedAsaasEnvironment(env)).toBe('INVALID');
    expect(asaasConfigurationReady(env, sandbox, sandboxKey)).toBe(false);
    expect(asaasConfigurationReady(env, production, productionKey)).toBe(false);
    expect(asaasConfigurationReady(env, 'invalid', sandboxKey)).toBe(false);
  });
  it.each([undefined, '', 'bad/scope', 'a'.repeat(25)])('requires a valid explicit account scope %j', scope => {
    const env = { NODE_ENV: 'production', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX', ASAAS_ACCOUNT_SCOPE: scope };
    expect(expectedAsaasEnvironment(env)).toBe('INVALID');
    expect(asaasConfigurationReady(env, sandbox, sandboxKey)).toBe(false);
  });
  it('rejects overrides conflicting with the hosting context', () => {
    const env = { NODE_ENV: 'production', ASAAS_ACCOUNT_SCOPE: 'fixture' };
    for (const extra of [
      { VERCEL: '1', VERCEL_ENV: 'production', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX' },
      { VERCEL_ENV: 'production', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX' },
      { VERCEL: '1', VERCEL_ENV: 'preview', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'PRODUCTION' },
      { VERCEL: '1', VERCEL_ENV: 'unknown', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX' },
    ]) {
      expect(expectedAsaasEnvironment({ ...env, ...extra })).toBe('INVALID');
    }
    expect(expectedAsaasEnvironment({ ...preview, ASAAS_ACCOUNT_SCOPE: 'sandbox-hml', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX' })).toBe('SANDBOX');
    expect(expectedAsaasEnvironment({ ...env, VERCEL: '1', VERCEL_ENV: 'production', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'PRODUCTION' })).toBe('PRODUCTION');
  });
  it('uses explicit deployment policy in the real client capability check without transport', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('PAYMENT_DEPLOYMENT_ENVIRONMENT', 'SANDBOX'); vi.stubEnv('ASAAS_ACCOUNT_SCOPE', 'sandbox-hml');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    try {
      expect(new AsaasClient(sandbox, sandboxKey).configurationReady()).toBe(true);
      expect(new AsaasClient(production, productionKey).configurationReady()).toBe(false);
      vi.stubEnv('PAYMENT_DEPLOYMENT_ENVIRONMENT', 'typo');
      expect(new AsaasClient(sandbox, sandboxKey).configurationReady()).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it('allows Sandbox for an identified optimized Vercel Preview, never production credentials', () => {
    expect(expectedAsaasEnvironment(preview)).toBe('SANDBOX');
    expect(asaasConfigurationReady(preview, sandbox, sandboxKey)).toBe(true);
    expect(asaasConfigurationReady(preview, production, productionKey)).toBe(false);
    expect(asaasConfigurationReady(preview, sandbox, productionKey)).toBe(false);
  });
  it('keeps an optimized runtime outside identified Preview on production', () => {
    for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'production', VERCEL_ENV: 'preview' },
      { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'unrecognized' }]) {
      expect(expectedAsaasEnvironment(env)).toBe('PRODUCTION');
      expect(asaasConfigurationReady(env, production, productionKey)).toBe(true);
      expect(asaasConfigurationReady(env, sandbox, sandboxKey)).toBe(false);
    }
  });
  it('never classifies a declared Vercel production deployment as Sandbox', () => {
    for (const NODE_ENV of ['production', 'development', 'test']) {
      const env = { NODE_ENV, VERCEL: '1', VERCEL_ENV: 'production' };
      expect(expectedAsaasEnvironment(env)).toBe('PRODUCTION');
      expect(asaasConfigurationReady(env, sandbox, sandboxKey)).toBe(false);
    }
  });
  it('preserves Sandbox for ordinary development and tests', () => {
    for (const NODE_ENV of ['development', 'test']) {
      expect(asaasConfigurationReady({ NODE_ENV }, sandbox, sandboxKey)).toBe(true);
      expect(asaasConfigurationReady({ NODE_ENV }, production, productionKey)).toBe(false);
    }
  });
  it('rejects unsupported hosts, ports, paths and credentials embedded in URLs', () => {
    for (const url of ['http://api-sandbox.asaas.com/v3', 'https://api-sandbox.asaas.com:8443/v3',
      'https://api-sandbox.asaas.com.evil.invalid/v3', 'https://user:pass@api-sandbox.asaas.com/v3',
      sandbox + '?token=CANARY', sandbox + '#CANARY', sandbox + '/other', 'invalid']) {
      expect(asaasGatewayTarget(url)).toBe('INVALID');
      expect(asaasConfigurationReady(preview, url, sandboxKey)).toBe(false);
    }
    expect(asaasGatewayTarget(sandbox + '/')).toBe('SANDBOX');
    expect(asaasGatewayTarget('https://sandbox.asaas.com/api/v3')).toBe('SANDBOX');
  });
  it('requires a key with the matching prefix', () => {
    for (const key of ['', 'CANARY', productionKey]) expect(asaasConfigurationReady(preview, sandbox, key)).toBe(false);
    expect(asaasConfigurationReady({ NODE_ENV: 'production' }, production, sandboxKey)).toBe(false);
  });
  it('uses the shared rule in the real client capability check without network calls', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'preview');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    try {
      expect(new AsaasClient(sandbox, sandboxKey).configurationReady()).toBe(true);
      expect(new AsaasClient(production, productionKey).configurationReady()).toBe(false);
      vi.stubEnv('VERCEL_ENV', 'production');
      expect(new AsaasClient(sandbox, sandboxKey).configurationReady()).toBe(false);
      expect(new AsaasClient(production, productionKey).configurationReady()).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
