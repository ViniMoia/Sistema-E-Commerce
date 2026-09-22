import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderOrderPaymentConfirmedEmail } from '@/lib/email/templates/order-payment-confirmed.template';
import { ResendEmailService } from '@/lib/email/providers/resend.provider';
import { DevEmailService } from '@/lib/email/providers/dev.provider';
import type { OrderPaymentConfirmedEmailParams } from '@/lib/email/email.types';

describe('Notificação de Pagamento ao Cliente via E-mail (PEND-COM-002)', () => {
  const baseParams: OrderPaymentConfirmedEmailParams = {
    to: 'cliente@exemplo.com',
    customerName: 'Vinicius Moia',
    orderNumber: 1054,
    totalValue: 289.9,
    paymentDate: new Date('2026-09-22T14:30:00Z'),
    items: [
      {
        name: 'Shampoo Automotivo V-Floc 1.5L',
        quantity: 2,
        price: 89.95,
        color: null,
        size: '1.5L',
      },
      {
        name: 'Cera Líquida Blend Spray 500ml',
        quantity: 1,
        price: 110.0,
      },
    ],
    deliveryType: 'DELIVERY',
    shippingServiceName: 'SEDEX Express',
    shippingEstimatedDays: 3,
    addressFormatted: 'Rua das Palmeiras, 120, Apto 402 - Curitiba/PR',
    pointsEarned: 28,
    storeName: 'Continental Produtos Estéticos',
    orderUrl: 'https://continentalestetica.com.br/profile/orders/ord-1054',
  };

  describe('1. Renderização do Template HTML & Texto', () => {
    it('deve compilar com sucesso com todos os dados do pedido', () => {
      const { html, text } = renderOrderPaymentConfirmedEmail(baseParams);

      expect(html).toContain('Vinicius');
      expect(html).toContain('#1054');
      expect(html).toContain('Shampoo Automotivo V-Floc 1.5L');
      expect(html).toContain('Cera Líquida Blend Spray 500ml');
      expect(html).toContain('SEDEX Express (Estimativa: 3 dias úteis)');
      expect(html).toContain('Rua das Palmeiras, 120, Apto 402 - Curitiba/PR');
      expect(html).toContain('★ Parabéns! Você ganhou +28 pontos de fidelidade nesta compra!');
      expect(html).toContain('https://continentalestetica.com.br/profile/orders/ord-1054');

      // Texto plano
      expect(text).toContain('Vinicius');
      expect(text).toContain('#1054');
      expect(text).toContain('Shampoo Automotivo V-Floc 1.5L');
      expect(text).toContain('https://continentalestetica.com.br/profile/orders/ord-1054');
    });

    it('deve sanitizar caracteres HTML para prevenir injeção XSS', () => {
      const maliciousParams: OrderPaymentConfirmedEmailParams = {
        ...baseParams,
        customerName: '<script>alert("hack")</script> João & Maria',
        items: [
          {
            name: '<img src=x onerror=alert(1)> Produto Perigoso',
            quantity: 1,
            price: 50.0,
            color: '"><script>xss()</script>',
          },
        ],
      };

      const { html } = renderOrderPaymentConfirmedEmail(maliciousParams);

      expect(html).not.toContain('<script>alert("hack")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;');
      expect(html).toContain('João &amp; Maria');

      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('&quot;&gt;&lt;script&gt;xss()&lt;/script&gt;');
    });

    it('deve ocultar o banner de pontos quando o cliente não acumular pontos', () => {
      const paramsWithoutPoints: OrderPaymentConfirmedEmailParams = {
        ...baseParams,
        pointsEarned: 0,
      };

      const { html, text } = renderOrderPaymentConfirmedEmail(paramsWithoutPoints);

      expect(html).not.toContain('Parabéns! Você ganhou +');
      expect(text).not.toContain('Você acumulou +');
    });

    it('deve renderizar adequadamente a modalidade de Retirada no Balcão (PICKUP)', () => {
      const pickupParams: OrderPaymentConfirmedEmailParams = {
        ...baseParams,
        deliveryType: 'PICKUP',
        shippingServiceName: null,
        shippingEstimatedDays: null,
        addressFormatted: null,
      };

      const { html, text } = renderOrderPaymentConfirmedEmail(pickupParams);

      expect(html).toContain('Retirada no Balcão');
      expect(text).toContain('Retirada no Balcão');
    });
  });

  describe('2. Provedor Resend (ResendEmailService)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('deve avisar de forma segura e não quebrar se RESEND_API_KEY não estiver configurada', async () => {
      const resendService = new ResendEmailService('', 'from@test.com');
      const result = await resendService.sendOrderPaymentConfirmedEmail(baseParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('RESEND_API_KEY não configurada');
    });

    it('deve enviar e-mail com sucesso através da API do Resend quando configurado', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-msg-12345' }),
      });

      const resendService = new ResendEmailService('re_valid_key_123', 'loja@continental.com');
      const result = await resendService.sendOrderPaymentConfirmedEmail(baseParams);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('resend-msg-12345');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, requestInit] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect((requestInit as any).headers['Authorization']).toBe('Bearer re_valid_key_123');

      const body = JSON.parse((requestInit as any).body);
      expect(body.to).toEqual(['cliente@exemplo.com']);
      expect(body.subject).toContain('Pagamento Confirmado: Pedido #1054');
      expect(body.html).toContain('Continental');
    });
  });

  describe('3. Provedor de Desenvolvimento (DevEmailService)', () => {
    it('deve registrar o e-mail em memória com sucesso', async () => {
      const devService = new DevEmailService();
      const result = await devService.sendOrderPaymentConfirmedEmail(baseParams);

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-email-/);

      const lastEmail = devService.getLastEmail();
      expect(lastEmail).toBeDefined();
      expect(lastEmail?.options.to).toBe('cliente@exemplo.com');
      expect(lastEmail?.options.subject).toContain('#1054');
    });
  });
});
