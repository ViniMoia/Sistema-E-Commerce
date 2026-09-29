import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrderSchema } from '@/lib/validators/checkout.validators';
import { POST } from '@/app/api/checkout/route';
import * as tenantLib from '@/lib/tenant';
import * as sessionLib from '@/lib/session';
import * as checkoutService from '@/services/checkout.service';

vi.mock('@/lib/tenant', () => ({
  getLojaFromHeaders: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/services/checkout.service', () => ({
  createOrder: vi.fn(),
}));

describe('Enforcement Estrito de CPF/CNPJ no Checkout (Fase 7 QA)', () => {
  const validBasePayload = {
    lojaID: 'loja-continental-1',
    customer: {
      name: 'João Silva',
      email: 'joao.silva@exemplo.com',
      phone: '(11) 98765-4321',
    },
    items: [
      {
        productId: 'prod-001',
        name: 'Cera Carnaúba Express 500ml',
        quantity: 2,
        price: 79.9,
      },
    ],
    deliveryType: 'PICKUP' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tenantLib.getLojaFromHeaders).mockResolvedValue({
      id: 'loja-continental-1',
      name: 'Continental Produtos Estéticos',
      slug: 'continental',
    } as any);
    vi.mocked(sessionLib.getCurrentUser).mockResolvedValue(null);
  });

  describe('Validação no Schema Zod (createOrderSchema)', () => {
    it('deve rejeitar payload com CPF ausente (undefined)', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const cpfIssue = result.error.issues.find((issue) =>
          issue.path.includes('cpfCnpj')
        );
        expect(cpfIssue).toBeDefined();
        expect(cpfIssue?.message).toContain('obrigatório');
      }
    });

    it('deve rejeitar payload com CPF vazio ou apenas espaços', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: '   ',
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const cpfIssue = result.error.issues.find((issue) =>
          issue.path.includes('cpfCnpj')
        );
        expect(cpfIssue).toBeDefined();
      }
    });

    it('deve rejeitar CPF com dígitos repetidos (ex: 111.111.111-11)', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: '111.111.111-11',
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const cpfIssue = result.error.issues.find((issue) =>
          issue.path.includes('cpfCnpj')
        );
        expect(cpfIssue?.message).toContain('inválido');
      }
    });

    it('deve rejeitar CPF com dígitos verificadores matematicamente incorretos', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: '123.456.789-00',
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const cpfIssue = result.error.issues.find((issue) =>
          issue.path.includes('cpfCnpj')
        );
        expect(cpfIssue?.message).toContain('inválido');
      }
    });

    it('deve rejeitar CNPJ com dígitos verificadores matematicamente incorretos', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: '11.222.333/0001-99',
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const cpfIssue = result.error.issues.find((issue) =>
          issue.path.includes('cpfCnpj')
        );
        expect(cpfIssue?.message).toContain('inválido');
      }
    });

    it('deve aceitar CPF matematicamente válido formatado', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: '529.982.247-25',
        },
      });

      expect(result.success).toBe(true);
    });

    it('deve aceitar CPF matematicamente válido sem formatação', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: '52998224725',
        },
      });

      expect(result.success).toBe(true);
    });

    it('deve aceitar CNPJ matematicamente válido formatado', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: '11.222.333/0001-81',
        },
      });

      expect(result.success).toBe(true);
    });

    it('deve aceitar CNPJ matematicamente válido sem formatação', () => {
      const result = createOrderSchema.safeParse({
        ...validBasePayload,
        customer: {
          ...validBasePayload.customer,
          cpfCnpj: '11222333000181',
        },
      });

      expect(result.success).toBe(true);
    });

    it('deve rejeitar 51 itens e quantidade unitária acima de 100', () => {
      const customer = {
        ...validBasePayload.customer,
        cpfCnpj: '529.982.247-25',
      };
      const tooManyItems = createOrderSchema.safeParse({
        ...validBasePayload,
        customer,
        items: Array.from({ length: 51 }, (_, index) => ({
          productId: `prod-${index}`,
          name: 'Produto',
          quantity: 1,
          price: 10,
        })),
      });
      const excessiveQuantity = createOrderSchema.safeParse({
        ...validBasePayload,
        customer,
        items: [{ productId: 'prod-1', name: 'Produto', quantity: 101, price: 10 }],
      });

      expect(tooManyItems.success).toBe(false);
      expect(excessiveQuantity.success).toBe(false);
    });
  });

  describe('Comportamento HTTP da Rota (POST /api/checkout)', () => {
    it('exige cartId e deriva owner/tenant da sessão no checkout autenticado', async () => {
      vi.mocked(sessionLib.getCurrentUser).mockResolvedValueOnce({
        id: 'user-session-1',
        lojaID: 'loja-continental-1',
      } as any);
      const withoutCart = await POST(new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'authenticated-checkout-without-cart-0001',
        },
        body: JSON.stringify({
          ...validBasePayload,
          customer: { ...validBasePayload.customer, cpfCnpj: '529.982.247-25' },
        }),
      }));
      expect(withoutCart.status).toBe(400);
      await expect(withoutCart.json()).resolves.toMatchObject({ code: 'CART_ID_REQUIRED' });
      expect(checkoutService.createOrder).not.toHaveBeenCalled();

      vi.mocked(sessionLib.getCurrentUser).mockResolvedValueOnce({
        id: 'user-session-1',
        lojaID: 'loja-continental-1',
      } as any);
      vi.mocked(checkoutService.createOrder).mockResolvedValueOnce({
        success: true,
        order: { id: 'order-session-1', orderNumber: 2002, total: 159.8 } as any,
      });
      const cartId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const withCart = await POST(new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'authenticated-checkout-with-cart-0002',
        },
        body: JSON.stringify({
          ...validBasePayload,
          cartId,
          customer: { ...validBasePayload.customer, cpfCnpj: '529.982.247-25' },
        }),
      }));
      expect(withCart.status).toBe(200);
      expect(checkoutService.createOrder).toHaveBeenCalledWith(expect.objectContaining({
        lojaID: 'loja-continental-1',
        cartId,
        customer: expect.objectContaining({ userId: 'user-session-1' }),
      }));
    });

    it('deve responder HTTP 400 com mensagem clara quando CPF/CNPJ for omitido', async () => {
      const req = new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'cpf-valid-checkout-request-0001',
        },
        body: JSON.stringify({
          ...validBasePayload,
          customer: {
            name: 'Cliente Sem CPF',
            email: 'cliente@exemplo.com',
            phone: '11988887777',
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/CPF ou CNPJ é obrigatório/i);
      expect(checkoutService.createOrder).not.toHaveBeenCalled();
    });

    it('deve responder HTTP 400 com mensagem clara quando CPF for matematicamente inválido', async () => {
      const req = new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validBasePayload,
          customer: {
            name: 'Cliente CPF Inválido',
            email: 'cliente@exemplo.com',
            phone: '11988887777',
            cpfCnpj: '000.000.000-00',
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/CPF ou CNPJ inválido/i);
      expect(checkoutService.createOrder).not.toHaveBeenCalled();
    });

    it('deve permitir processamento quando CPF for matematicamente válido', async () => {
      vi.mocked(checkoutService.createOrder).mockResolvedValueOnce({
        success: true,
        order: {
          id: 'ord-123',
          orderNumber: 2001,
          total: 159.8,
          pixQrCode: 'base64-img',
          pixPayload: 'pix-payload',
        } as any,
      });

      const req = new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'cpf-valid-checkout-request-0002',
        },
        body: JSON.stringify({
          ...validBasePayload,
          customer: {
            ...validBasePayload.customer,
            cpfCnpj: '529.982.247-25',
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(checkoutService.createOrder).toHaveBeenCalled();
    });

    it('deve substituir correlation header invÃ¡lido e devolver referÃªncia interna segura', async () => {
      const req = new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': '<script>'.repeat(40),
        },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.headers.get('x-request-id')).not.toContain('<script>');
    });
  });
});
