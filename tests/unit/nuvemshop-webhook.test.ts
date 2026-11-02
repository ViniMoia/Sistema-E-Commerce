import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { POST } from '@/app/api/webhooks/nuvemshop/route';
import {
  verifyNuvemshopWebhookHmac,
  receiveNuvemshopWebhook,
} from '@/lib/integrations/nuvemshop-webhook';
import prisma from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn((work) => work(prisma)),
    paymentWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const secretFixture = 'test-nuvemshop-client-secret-12345';
const storeIdFixture = '8179726';

function signBody(body: string, secret = secretFixture): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

const validPayload = {
  store_id: 8179726,
  event: 'order/created',
  id: 12345678,
};

function buildRequest(body: unknown = validPayload, signature?: string, headers: Record<string, string> = {}) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  const sig = signature !== undefined ? signature : signBody(rawBody);
  const reqHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...(sig ? { 'x-linkedstore-hmac-sha256': sig } : {}),
    ...headers,
  };
  return new Request('http://localhost/api/webhooks/nuvemshop', {
    method: 'POST',
    headers: reqHeaders,
    body: rawBody,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NUVEMSHOP_CLIENT_SECRET', secretFixture);
  vi.stubEnv('NUVEMSHOP_STORE_ID', storeIdFixture);
  vi.stubEnv('NUVEMSHOP_WEBHOOK_ENABLED', 'true');

  vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.paymentWebhookEvent.create).mockResolvedValue({
    id: 'we-fixture-1',
    eventId: 'evt-fixture',
    provider: `NUVEMSHOP:${storeIdFixture}`,
    eventType: 'order/created',
    payload: validPayload,
    processedAt: new Date(),
  } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Nuvemshop Webhook HMAC Verification', () => {
  it('approves a valid signature matching the body and secret', () => {
    const body = JSON.stringify({ ping: 'pong' });
    const sig = signBody(body, 'my-secret');
    expect(verifyNuvemshopWebhookHmac(body, sig, 'my-secret')).toBe(true);
  });

  it('approves case-insensitive hexadecimal signatures', () => {
    const body = JSON.stringify({ ping: 'pong' });
    const sig = signBody(body, 'my-secret').toUpperCase();
    expect(verifyNuvemshopWebhookHmac(body, sig, 'my-secret')).toBe(true);
  });

  it('rejects an invalid signature with the same length', () => {
    const body = JSON.stringify({ ping: 'pong' });
    const sig = 'a'.repeat(64);
    expect(verifyNuvemshopWebhookHmac(body, sig, 'my-secret')).toBe(false);
  });

  it('rejects signature with wrong secret', () => {
    const body = JSON.stringify({ ping: 'pong' });
    const sig = signBody(body, 'wrong-secret');
    expect(verifyNuvemshopWebhookHmac(body, sig, 'my-secret')).toBe(false);
  });

  it('rejects empty, null or undefined signatures', () => {
    const body = JSON.stringify({ ping: 'pong' });
    expect(verifyNuvemshopWebhookHmac(body, '', 'my-secret')).toBe(false);
    expect(verifyNuvemshopWebhookHmac(body, null, 'my-secret')).toBe(false);
    expect(verifyNuvemshopWebhookHmac(body, undefined, 'my-secret')).toBe(false);
  });

  it('rejects empty body', () => {
    expect(verifyNuvemshopWebhookHmac('', 'sig', 'my-secret')).toBe(false);
  });
});

describe('Nuvemshop Webhook Ingestion Service', () => {
  it('successfully ingests a valid order/created event', async () => {
    const rawBody = JSON.stringify(validPayload);
    const signature = signBody(rawBody);

    const receipt = await receiveNuvemshopWebhook({
      rawBody,
      signature,
      secret: secretFixture,
      expectedStoreId: storeIdFixture,
    });

    expect(receipt.received).toBe(true);
    expect(receipt.isDuplicate).toBe(false);
    expect(receipt.storeId).toBe(storeIdFixture);
    expect(receipt.event).toBe('order/created');
    expect(receipt.resourceId).toBe('12345678');
    expect(prisma.paymentWebhookEvent.create).toHaveBeenCalledTimes(1);
  });

  it('successfully ingests a product/updated event with string IDs', async () => {
    const productPayload = {
      store_id: '8179726',
      event: 'product/updated',
      id: '99887766',
    };
    const rawBody = JSON.stringify(productPayload);
    const signature = signBody(rawBody);

    const receipt = await receiveNuvemshopWebhook({
      rawBody,
      signature,
      secret: secretFixture,
    });

    expect(receipt.received).toBe(true);
    expect(receipt.isDuplicate).toBe(false);
    expect(receipt.event).toBe('product/updated');
    expect(receipt.resourceId).toBe('99887766');
  });

  it('detects and flags duplicate event without re-creating', async () => {
    vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce({
      id: 'existing-evt',
    } as never);

    const rawBody = JSON.stringify(validPayload);
    const signature = signBody(rawBody);

    const receipt = await receiveNuvemshopWebhook({
      rawBody,
      signature,
      secret: secretFixture,
    });

    expect(receipt.received).toBe(true);
    expect(receipt.isDuplicate).toBe(true);
    expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('rejects store mismatch when expected store is configured', async () => {
    const mismatchPayload = {
      store_id: 9999999,
      event: 'order/created',
      id: 12345678,
    };
    const rawBody = JSON.stringify(mismatchPayload);
    const signature = signBody(rawBody);

    await expect(
      receiveNuvemshopWebhook({
        rawBody,
        signature,
        secret: secretFixture,
        expectedStoreId: '8179726',
      })
    ).rejects.toThrow('NUVEMSHOP_WEBHOOK_STORE_MISMATCH');
  });

  it('rejects invalid JSON payload', async () => {
    const rawBody = '{ broken json';
    const signature = signBody(rawBody);

    await expect(
      receiveNuvemshopWebhook({
        rawBody,
        signature,
        secret: secretFixture,
      })
    ).rejects.toThrow('NUVEMSHOP_WEBHOOK_INVALID_JSON');
  });

  it('rejects invalid schema payload (missing event or id)', async () => {
    const badPayload = { store_id: 8179726, something: 'else' };
    const rawBody = JSON.stringify(badPayload);
    const signature = signBody(rawBody);

    await expect(
      receiveNuvemshopWebhook({
        rawBody,
        signature,
        secret: secretFixture,
      })
    ).rejects.toThrow('NUVEMSHOP_WEBHOOK_PAYLOAD_INVALID');
  });
});

describe('Nuvemshop Webhook Route Handler (POST)', () => {
  it('returns 503 if webhook secret is not configured', async () => {
    vi.stubEnv('NUVEMSHOP_CLIENT_SECRET', '');
    vi.stubEnv('NUVEMSHOP_WEBHOOK_SECRET', '');
    const res = await POST(buildRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'Configuração de webhook não inicializada.' });
  });

  it('returns 503 if webhook ingestion is explicitly disabled via kill switch', async () => {
    vi.stubEnv('NUVEMSHOP_WEBHOOK_ENABLED', 'false');
    const res = await POST(buildRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'Ingestão de webhook Nuvemshop desativada.' });
  });

  it('returns 401 if HMAC signature header is missing', async () => {
    const req = buildRequest(validPayload, '');
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Assinatura HMAC ausente.' });
  });

  it('returns 401 if HMAC signature is invalid', async () => {
    const req = buildRequest(validPayload, 'bad-signature-of-incorrect-hash');
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Assinatura HMAC inválida.' });
  });

  it('returns 413 if payload exceeds 256KB', async () => {
    const hugeBody = JSON.stringify({ ...validPayload, padding: 'x'.repeat(260000) });
    const req = buildRequest(hugeBody);
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('returns 400 if payload is not valid JSON', async () => {
    const brokenBody = 'invalid json payload';
    const req = buildRequest(brokenBody);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if payload is missing mandatory fields', async () => {
    const invalidBody = JSON.stringify({ store_id: 8179726 });
    const req = buildRequest(invalidBody);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 if store_id does not match authorized store', async () => {
    const unauthorizedBody = JSON.stringify({
      store_id: 111222,
      event: 'order/created',
      id: 555,
    });
    const req = buildRequest(unauthorizedBody);
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Loja remota não autorizada.' });
  });

  it('returns 200 with receipt on successful valid webhook delivery', async () => {
    const req = buildRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      received: true,
      storeId: '8179726',
      event: 'order/created',
      resourceId: '12345678',
      isDuplicate: false,
    });
  });

  it('returns 503 if database persistence throws', async () => {
    vi.mocked(prisma.paymentWebhookEvent.create).mockRejectedValueOnce(new Error('DB crash'));
    const req = buildRequest(validPayload);
    const res = await POST(req);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'Evento não persistido; repetir entrega.' });
  });
});
