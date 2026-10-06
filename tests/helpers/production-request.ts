import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { testServerConfig } from '@/lib/testing/database-policy';

export function productionOrigins() {
  if (process.env.TEST_APP_RUNTIME !== 'production' || !process.env.TEST_SECONDARY_BASE_URL) {
    throw new Error('Use npm run test:production:isolated; duas instâncias production são obrigatórias.');
  }
  const primary = testServerConfig();
  const secondary = testServerConfig({ ...process.env, TEST_BASE_URL: process.env.TEST_SECONDARY_BASE_URL });
  if (primary.baseUrl === secondary.baseUrl) throw new Error('Instâncias de homologação devem ser diferentes.');
  return [primary, secondary] as const;
}

export async function productionRequest(instance: 0 | 1, method: string, route: string,
  body?: unknown, headers: Record<string, string> = {}) {
  const config = productionOrigins()[instance];
  if (!route.startsWith('/') || route.startsWith('//') || new URL(route, config.baseUrl).origin !== config.baseUrl) {
    throw new Error('Path de homologação deve ser relativo à instância isolada.');
  }
  const handshake = await fetch(config.baseUrl + '/api/test-environment', {
    headers: { 'x-test-environment-token': config.token }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!handshake.ok) throw new Error('Instância production não confirmou identidade.');
  const identity = await handshake.json();
  if (identity.runId !== config.runId || identity.database !== config.database) throw new Error('Instância production divergente.');
  // Host selects a tenant, never a network destination. No redirects are followed.
  const startedAt = performance.now();
  return new Promise<{ status: number; body: unknown; headers: IncomingHttpHeaders; elapsedMs: number }>((resolve, reject) => {
    const request = httpRequest(new URL(route, config.baseUrl), {
      method, headers: { 'Content-Type': 'application/json', ...headers },
    }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('error', reject);
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 1024 * 1024) request.destroy(new Error('Resposta de homologação excede o limite.'));
        else chunks.push(chunk);
      });
      response.on('end', () => {
        const status = response.statusCode ?? 500;
        if (status >= 300 && status < 400) { reject(new Error('Redirect de homologação bloqueado.')); return; }
        try {
          const content = Buffer.concat(chunks).toString('utf8');
          resolve({ status, headers: response.headers, elapsedMs: performance.now() - startedAt,
            body: content && response.headers['content-type']?.includes('application/json') ? JSON.parse(content) : content });
        } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.setTimeout(10000, () => request.destroy(new Error('Timeout de homologação.')));
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

export async function restartSecondaryInstance() {
  const config = productionOrigins()[0];
  if (!process.env.TEST_PROCESS_CONTROL_URL) throw new Error('Controlador do harness não configurado.');
  const controller = testServerConfig({ ...process.env, TEST_BASE_URL: process.env.TEST_PROCESS_CONTROL_URL });
  if (productionOrigins().some(origin => origin.baseUrl === controller.baseUrl)) throw new Error('Controlador deve ser externo ao aplicativo.');
  const response = await fetch(controller.baseUrl + '/restart-secondary', {
    method: 'POST', headers: { 'x-test-environment-token': config.token },
    redirect: 'error', signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error('Restart da instância isolada falhou.');
  const identity = await response.json();
  if (identity.runId !== config.runId || identity.database !== config.database) throw new Error('Restart retornou identidade divergente.');
}
