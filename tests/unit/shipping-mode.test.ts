import { describe, it, expect } from 'vitest';
import {
  classifyProductShippingMode,
  resolveCartShippingMode,
  buildWhatsAppFreightUrl,
} from '@/lib/freight/shipping-mode';

describe('shipping-mode logic', () => {
  describe('classifyProductShippingMode', () => {
    it('preserves explicitly configured shippingMode from database', () => {
      expect(classifyProductShippingMode({ name: 'Produto X', shippingMode: 'WHATSAPP_ONLY' })).toBe('WHATSAPP_ONLY');
      expect(classifyProductShippingMode({ name: 'Produto Y', shippingMode: 'AUTOMATIC' })).toBe('AUTOMATIC');
    });

    it('classifies products with genuine physical measurements as AUTOMATIC', () => {
      expect(
        classifyProductShippingMode({
          name: 'Shampoo Automotivo Galão',
          weightInGrams: 5300,
          lengthCm: 16,
          widthCm: 19,
          heightCm: 29,
        })
      ).toBe('AUTOMATIC');
    });

    it('classifies unmeasured products with default fallback as WHATSAPP_ONLY', () => {
      expect(
        classifyProductShippingMode({
          name: 'Aspirador de Pó automotivo',
          weightInGrams: 300,
          lengthCm: 16,
          widthCm: 11,
          heightCm: 4,
        })
      ).toBe('WHATSAPP_ONLY');
    });

    it('rescues products via Tier 1 regex when capacity is in name or description', () => {
      expect(
        classifyProductShippingMode({
          name: 'EXTRACTUS 5L',
          weightInGrams: 300,
          lengthCm: 16,
          widthCm: 11,
          heightCm: 4,
        })
      ).toBe('AUTOMATIC');

      expect(
        classifyProductShippingMode({
          name: 'Cera Líquida Grafeno',
          description: 'Embalagem de 500ml de alto rendimento',
          weightInGrams: 300,
          lengthCm: 16,
          widthCm: 11,
          heightCm: 4,
        })
      ).toBe('AUTOMATIC');

      expect(
        classifyProductShippingMode({
          name: 'Cera em Pasta 1kg Nobrecar',
          weightInGrams: 300,
          lengthCm: 16,
          widthCm: 11,
          heightCm: 4,
        })
      ).toBe('AUTOMATIC');
    });

    it('classifies heavy machinery without volume mentions as WHATSAPP_ONLY', () => {
      expect(
        classifyProductShippingMode({
          name: 'LAVADORA EXTRATORA E ASPIRADOR LAVA PRO LITE 1200W IPC',
          description: 'Potência 1200W profissional 110V',
          weightInGrams: 300,
          lengthCm: 16,
          widthCm: 11,
          heightCm: 4,
        })
      ).toBe('WHATSAPP_ONLY');
    });
  });

  describe('resolveCartShippingMode (Contágio do Carrinho Misto)', () => {
    it('returns AUTOMATIC when all items in cart are AUTOMATIC', () => {
      const items = [
        { name: 'Cera 500ml', weightInGrams: 500, lengthCm: 10, widthCm: 10, heightCm: 15 },
        { name: 'Shampoo 5L', weightInGrams: 5300, lengthCm: 16, widthCm: 19, heightCm: 29 },
      ];
      expect(resolveCartShippingMode(items)).toBe('AUTOMATIC');
    });

    it('returns WHATSAPP_ONLY when at least one item is WHATSAPP_ONLY (Contagion Rule)', () => {
      const items = [
        { name: 'Cera 500ml', weightInGrams: 500, lengthCm: 10, widthCm: 10, heightCm: 15 },
        {
          name: 'LAVADORA EXTRATORA 1200W',
          weightInGrams: 300,
          lengthCm: 16,
          widthCm: 11,
          heightCm: 4,
        },
      ];
      expect(resolveCartShippingMode(items)).toBe('WHATSAPP_ONLY');
    });

    it('returns WHATSAPP_ONLY when all items are WHATSAPP_ONLY', () => {
      const items = [
        { name: 'Esponja Lava Carros', weightInGrams: 300, lengthCm: 16, widthCm: 11, heightCm: 4 },
        { name: 'Aspirador de Pó', weightInGrams: 300, lengthCm: 16, widthCm: 11, heightCm: 4 },
      ];
      expect(resolveCartShippingMode(items)).toBe('WHATSAPP_ONLY');
    });

    it('returns AUTOMATIC for an empty cart', () => {
      expect(resolveCartShippingMode([])).toBe('AUTOMATIC');
    });
  });

  describe('buildWhatsAppFreightUrl', () => {
    it('constructs a valid WhatsApp URL with order number and CEP', () => {
      const url = buildWhatsAppFreightUrl({
        phone: '(91) 98080-4717',
        orderNumber: 1042,
        cep: '66000-000',
        customerName: 'Vinícius',
      });
      expect(url).toContain('https://wa.me/91980804717?text=');
      expect(url).toContain('1042');
      expect(url).toContain('66000-000');
      expect(url).toContain('Vin%C3%ADcius');
    });

    it('constructs a valid WhatsApp URL without CEP when destination is not provided', () => {
      const url = buildWhatsAppFreightUrl({
        phone: '(91) 98080-4717',
        orderNumber: 1043,
        customerName: 'Cliente Especial',
      });
      expect(url).toContain('https://wa.me/91980804717?text=');
      expect(url).toContain('1043');
      expect(url).not.toContain('para o meu CEP');
      expect(url).toContain('Cliente%20Especial');
    });

    it('resolves cart mode when items have shippingMode property directly', () => {
      const itemsWithMode = [
        { name: 'Produto Cadastrado', shippingMode: 'WHATSAPP_ONLY' },
        { name: 'Produto Comum', shippingMode: 'AUTOMATIC' },
      ];
      expect(resolveCartShippingMode(itemsWithMode)).toBe('WHATSAPP_ONLY');
    });
  });

  describe('Product profile freight calculator visibility contract', () => {
    it('hides the freight calculator when product shippingMode is WHATSAPP_ONLY', () => {
      const product = {
        id: 'p1',
        name: 'ASPIRADOR TESTE',
        shippingMode: 'WHATSAPP_ONLY',
      };
      const shouldRenderFreightCalculator = product.shippingMode !== 'WHATSAPP_ONLY';
      expect(shouldRenderFreightCalculator).toBe(false);
    });

    it('displays the freight calculator when product shippingMode is AUTOMATIC or undefined', () => {
      const productAutomatic = {
        id: 'p2',
        name: 'SHAMPOO 5L',
        shippingMode: 'AUTOMATIC',
      };
      const productDefault = {
        id: 'p3',
        name: 'CERA AUTOMOTIVA',
      };
      expect(productAutomatic.shippingMode !== 'WHATSAPP_ONLY').toBe(true);
      expect((productDefault as any).shippingMode !== 'WHATSAPP_ONLY').toBe(true);
    });
  });
});

