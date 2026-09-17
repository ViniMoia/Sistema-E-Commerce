import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/orders/[id]/confirm-delivery/route';
import prisma from '@/lib/prisma';
import * as guards from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: vi.fn(),
}));

describe('Customer Order Confirmation (POST /api/orders/[id]/confirm-delivery)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar 401 se usuário não estiver autenticado', async () => {
    vi.mocked(guards.requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );

    const req = new Request('http://localhost/api/orders/ord_1/confirm-delivery', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'ord_1' }) };

    const res = await POST(req, context);
    expect(res.status).toBe(401);
  });

  it('deve retornar 403 se o pedido pertencer a outro usuário (Defesa Anti-IDOR)', async () => {
    vi.mocked(guards.requireAuth).mockResolvedValueOnce({
      user: { id: 'user_attacker', role: 'CUSTOMER', status: 'ACTIVE' } as any,
    });

    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'ord_victim',
      orderNumber: 101,
      userID: 'user_legitimate',
      lojaID: 'loja_1',
      status: 'SHIPPED',
      deliveryType: 'DELIVERY',
    } as any);

    const req = new Request('http://localhost/api/orders/ord_victim/confirm-delivery', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'ord_victim' }) };

    const res = await POST(req, context);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Acesso negado');
  });

  it('deve retornar 400 se o pedido estiver em status PENDING (não enviado)', async () => {
    vi.mocked(guards.requireAuth).mockResolvedValueOnce({
      user: { id: 'user_1', role: 'CUSTOMER', status: 'ACTIVE' } as any,
    });

    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'ord_1',
      orderNumber: 102,
      userID: 'user_1',
      lojaID: 'loja_1',
      status: 'PENDING',
      deliveryType: 'DELIVERY',
    } as any);

    const req = new Request('http://localhost/api/orders/ord_1/confirm-delivery', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'ord_1' }) };

    const res = await POST(req, context);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('enviado');
  });

  it('deve confirmar recebimento com sucesso para pedido SHIPPED e registrar auditoria', async () => {
    vi.mocked(guards.requireAuth).mockResolvedValueOnce({
      user: { id: 'user_1', role: 'CUSTOMER', status: 'ACTIVE' } as any,
    });

    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'ord_shipped_1',
      orderNumber: 103,
      userID: 'user_1',
      lojaID: 'loja_1',
      status: 'SHIPPED',
      deliveryType: 'DELIVERY',
    } as any);

    const mockUpdated = {
      id: 'ord_shipped_1',
      orderNumber: 103,
      status: 'DELIVERED',
      deliveredConfirmedAt: new Date(),
    };

    vi.mocked(prisma.$transaction).mockResolvedValueOnce([mockUpdated, {}]);

    const req = new Request('http://localhost/api/orders/ord_shipped_1/confirm-delivery', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'ord_shipped_1' }) };

    const res = await POST(req, context);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.order.status).toBe('DELIVERED');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('deve retornar 400 se o pedido já estiver com status DELIVERED', async () => {
    vi.mocked(guards.requireAuth).mockResolvedValueOnce({
      user: { id: 'user_1', role: 'CUSTOMER', status: 'ACTIVE' } as any,
    });

    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'ord_delivered_1',
      orderNumber: 104,
      userID: 'user_1',
      lojaID: 'loja_1',
      status: 'DELIVERED',
      deliveryType: 'DELIVERY',
    } as any);

    const req = new Request('http://localhost/api/orders/ord_delivered_1/confirm-delivery', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'ord_delivered_1' }) };

    const res = await POST(req, context);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('já foi confirmado');
  });
});
