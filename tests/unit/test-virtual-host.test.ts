import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { get, post } from '@/tests/helpers/request';

let server: Server;
let received = 0;
let mismatch = false;
const originalBase = process.env.TEST_BASE_URL;
const originalToken = process.env.TEST_HTTP_TOKEN;
beforeAll(async () => {
  process.env.TEST_HTTP_TOKEN = 'a'.repeat(64);
  server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/test-environment') {
      res.end(JSON.stringify({ runId: mismatch ? '0'.repeat(32) : process.env.TEST_RUN_ID,
        database: decodeURIComponent(new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1)) }));
      return;
    }
    received++;
    if (req.url === '/redirect') {
      res.statusCode = 302; res.setHeader('Location', 'https://external.invalid/'); res.end('{}'); return;
    }
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => res.end(JSON.stringify({ host: req.headers.host,
      input: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null })));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor HTTP unitário inválido.');
  process.env.TEST_BASE_URL = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (originalBase === undefined) delete process.env.TEST_BASE_URL; else process.env.TEST_BASE_URL = originalBase;
  if (originalToken === undefined) delete process.env.TEST_HTTP_TOKEN; else process.env.TEST_HTTP_TOKEN = originalToken;
});
describe('Host virtual preserva a origem de rede protegida do teste', () => {
  it('envia Host explícito para o socket local verificado, sem lookup do domínio virtual', async () => {
    const response = await post('/virtual', { value: 1 }, { headers: { Host: 'tenant.example.invalid' } });
    expect(response).toMatchObject({ status: 200, body: { host: 'tenant.example.invalid', input: { value: 1 } } });
  });
  it('não segue redirect para outro servidor', async () => {
    await expect(get('/redirect', { headers: { Host: 'tenant.example.invalid' } })).rejects.toThrow('Redirect');
  });
  it('handshake divergente impede POST nativo, mesmo com Host virtual', async () => {
    const before = received;
    mismatch = true;
    try { await expect(post('/virtual', {}, { headers: { Host: 'tenant.example.invalid' } })).rejects.toThrow('ambientes diferentes'); }
    finally { mismatch = false; }
    expect(received).toBe(before);
  });
});
