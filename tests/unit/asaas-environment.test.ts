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
