import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '@/app/api/cron/orders-timeout/route';
import * as timeoutService from '@/services/order-timeout.service';

vi.mock('@/services/order-timeout.service', () => ({
  processExpiredOrders: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Endpoint de Cron: /api/cron/orders-timeout (Segurança & SecOps)', () => {
  const originalEnv = process.env;
  const TEST_SECRET = 'test_cron_secret_1234567890_abcdef';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: TEST_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('deve retornar HTTP 500 Fail-Closed se CRON_SECRET não estiver configurado no ambiente', async () => {
    delete process.env.CRON_SECRET;

    const req = new Request('http://localhost:3000/api/cron/orders-timeout', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TEST_SECRET}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toContain('Configuração de segurança do cron não inicializada');
    expect(timeoutService.processExpiredOrders).not.toHaveBeenCalled();
  });

  it('deve retornar HTTP 401 se a requisição não fornecer token de autorização', async () => {
    const req = new Request('http://localhost:3000/api/cron/orders-timeout', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain('Token de autorização não fornecido');
    expect(timeoutService.processExpiredOrders).not.toHaveBeenCalled();
  });

  it('deve retornar HTTP 401 se o token Bearer for inválido', async () => {
    const req = new Request('http://localhost:3000/api/cron/orders-timeout', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid_token_123',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain('Token de autorização inválido ou não autorizado');
    expect(timeoutService.processExpiredOrders).not.toHaveBeenCalled();
  });

  it('deve retornar HTTP 401 se o token possuir o mesmo tamanho mas conteúdo diferente (timing attack defense)', async () => {
    // Cria um token com mesmo length mas caracteres diferentes
    const forgedToken = TEST_SECRET.slice(0, -1) + 'X';

    const req = new Request('http://localhost:3000/api/cron/orders-timeout', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${forgedToken}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(timeoutService.processExpiredOrders).not.toHaveBeenCalled();
  });

  it('deve executar com sucesso via método GET com token Bearer válido', async () => {
    vi.mocked(timeoutService.processExpiredOrders).mockResolvedValueOnce({
      success: true,
      processedCount: 3,
      cancelledCount: 3,
      errorCount: 0,
      cancelledOrderIds: ['ord-1', 'ord-2', 'ord-3'],
      errors: [],
      executionTimeMs: 45,
    });

    const req = new Request('http://localhost:3000/api/cron/orders-timeout', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TEST_SECRET}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      success: true,
      processed: 3,
      cancelled: 3,
      errors: 0,
      cancelledOrderIds: ['ord-1', 'ord-2', 'ord-3'],
      executionTimeMs: 45,
    });

    expect(timeoutService.processExpiredOrders).toHaveBeenCalledWith({
      batchSize: undefined,
      lojaID: undefined,
    });
  });

  it('deve executar com sucesso via método POST com token Bearer válido', async () => {
    vi.mocked(timeoutService.processExpiredOrders).mockResolvedValueOnce({
      success: true,
      processedCount: 1,
      cancelledCount: 1,
      errorCount: 0,
      cancelledOrderIds: ['ord-post'],
      errors: [],
      executionTimeMs: 20,
    });

    const req = new Request('http://localhost:3000/api/cron/orders-timeout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_SECRET}`,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.cancelled).toBe(1);
    expect(timeoutService.processExpiredOrders).toHaveBeenCalled();
  });

  it('deve aceitar autenticação via cabeçalho x-cron-secret', async () => {
    vi.mocked(timeoutService.processExpiredOrders).mockResolvedValueOnce({
      success: true,
      processedCount: 0,
      cancelledCount: 0,
      errorCount: 0,
      cancelledOrderIds: [],
      errors: [],
      executionTimeMs: 5,
    });

    const req = new Request('http://localhost:3000/api/cron/orders-timeout', {
      method: 'GET',
      headers: {
        'x-cron-secret': TEST_SECRET,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(timeoutService.processExpiredOrders).toHaveBeenCalled();
  });

  it('deve repassar parâmetros de query batchSize e lojaID com limite de segurança', async () => {
    vi.mocked(timeoutService.processExpiredOrders).mockResolvedValueOnce({
      success: true,
      processedCount: 0,
      cancelledCount: 0,
      errorCount: 0,
      cancelledOrderIds: [],
      errors: [],
      executionTimeMs: 5,
    });

    const req = new Request(
      'http://localhost:3000/api/cron/orders-timeout?batchSize=20&lojaID=loja-teste',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${TEST_SECRET}`,
        },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    expect(timeoutService.processExpiredOrders).toHaveBeenCalledWith({
      batchSize: 20,
      lojaID: 'loja-teste',
    });
  });

  it('deve retornar HTTP 500 se o serviço de timeout lançar exceção crítica', async () => {
    vi.mocked(timeoutService.processExpiredOrders).mockRejectedValueOnce(
      new Error('Falha catastrófica de infraestrutura')
    );

    const req = new Request('http://localhost:3000/api/cron/orders-timeout', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TEST_SECRET}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toContain('Erro interno ao processar rotina de timeout');
  });
});
