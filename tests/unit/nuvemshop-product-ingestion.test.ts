import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import {
  ingestProductFromNuvemshop,
  calculateFreightDimensions,
  sanitizeHtmlDescription,
  retireProductCascade,
  reconcileCategoriesAndTags,
  nuvemshopCanonicalProductSchema,
} from '@/lib/integrations/nuvemshop-product-ingestion';
import { drainNuvemshopOutbox } from '@/services/payment/payment-outbox.service';

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn((work) => work(prisma)),
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'mock' }]),
    loja: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productVariants: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    categoryTag: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    productCategoryTag: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    inventoryReservation: {
      deleteMany: vi.fn(),
    },
    commerceOutbox: {
      findUniqueOrThrow: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/services/payment/durable-work.service', () => ({
  claimWork: vi.fn().mockResolvedValue({ ids: [], owner: 'test-worker' }),
  fenceWork: vi.fn().mockResolvedValue(true),
  completeWork: vi.fn().mockResolvedValue(true),
  retryWork: vi.fn().mockResolvedValue(true),
}));

const mockLoja = {
  id: 'loja-uuid-123',
  nuvemshopStoreId: '8179726',
};

const mockAdminUser = {
  id: 'user-admin-uuid',
  lojaID: 'loja-uuid-123',
  role: 'ADMIN',
  status: 'ACTIVE',
};

describe('Nuvemshop Product Ingestion - Heurística e Sanitização', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NUVEMSHOP_STORE_ID', '8179726');
    vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', 'token-test');
  });

  describe('Heurística 3-Tier de Frete & Cubagem', () => {
    it('extrai peso em kg do título por Regex (Tier 1)', () => {
      const result = calculateFreightDimensions('Ração Golden Carne 15kg', 'Pacote econômico');
      expect(result.weightInGrams).toBe(15000);
      expect(result.lengthCm).toBe(16);
      expect(result.widthCm).toBe(11);
      expect(result.heightCm).toBe(4);
    });

    it('extrai peso em gramas do título por Regex e aplica piso de 300g (Tier 1 & 3)', () => {
      const result = calculateFreightDimensions('Pomada Modeladora 150g', 'Fixação forte');
      expect(result.weightInGrams).toBe(300); // 150g clamped to 300g minimum
      expect(result.weightInGrams).toBeGreaterThanOrEqual(300);
    });

    it('extrai peso em Litros convertendo para gramas (Tier 1)', () => {
      const result = calculateFreightDimensions('Shampoo Hidratante 5L', 'Galão profissional');
      expect(result.weightInGrams).toBe(5000);
    });

    it('aplica piso mínimo de 300g quando o lojista cadastra peso 0 ou nulo (Tier 3)', () => {
      const result = calculateFreightDimensions('Camiseta Básica', 'Algodão', 0, 0, 0, 0);
      expect(result.weightInGrams).toBe(300);
      expect(result.lengthCm).toBe(16);
      expect(result.widthCm).toBe(11);
      expect(result.heightCm).toBe(4);
    });

    it('converte medidas cadastradas em metros (< 1.0) para centímetros (Tier 2)', () => {
      // Exemplo: 0.16 metros -> 16 cm; 0.25 metros -> 25 cm
      const result = calculateFreightDimensions('Caixa de Som', 'Portátil', '0.500', '0.25', '0.20', '0.10');
      expect(result.weightInGrams).toBe(500);
      expect(result.lengthCm).toBe(25);
      expect(result.widthCm).toBe(20);
      expect(result.heightCm).toBe(10);
    });

    it('sinaliza frete especial quando o peso excede 30kg ou cubagem excede 200cm', () => {
      const result = calculateFreightDimensions('Equipamento Laser 35kg', 'Laser industrial', 35);
      expect(result.isSpecialFreight).toBe(true);
    });
  });

  describe('Sanitização HTML Anti-XSS', () => {
    it('remove scripts, iframes e handlers onclick de descrições ricas', () => {
      const rawHtml = '<p>Descrição válida</p><script>alert("xss")</script><iframe src="evil.com"></iframe><div onclick="doBad()">Clique</div>';
      const clean = sanitizeHtmlDescription(rawHtml);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('<iframe>');
      expect(clean).not.toContain('onclick');
      expect(clean).toContain('<p>Descrição válida</p>');
      expect(clean).toContain('<div>Clique</div>');
    });
  });

  describe('Schema Zod Resiliente a Dados Multilíngues da Nuvemshop v1', () => {
    it('aceita strings localizadas no formato { pt: "...", es: "..." }', () => {
      const rawProduct = {
        id: 12345,
        name: { pt: 'Creme Antirrugas', es: 'Crema Antiarrugas' },
        description: { pt: '<p>Fórmula avançada</p>' },
        price: '120.00',
        images: [{ src: 'https://dcdn-us.mitiendanube.com/img1.jpg' }],
        categories: [{ id: 10, name: { pt: 'Cosméticos' } }],
        variants: [
          {
            id: 999,
            sku: 'CRM-01',
            price: '120.00',
            stock: 10,
            values: [{ pt: 'Único' }],
          },
        ],
      };

      const parsed = nuvemshopCanonicalProductSchema.safeParse(rawProduct);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe('Creme Antirrugas');
        expect(parsed.data.description).toBe('<p>Fórmula avançada</p>');
        expect(parsed.data.categories[0].name).toBe('Cosméticos');
      }
    });
  });
});

describe('Nuvemshop Product Ingestion - Ciclo de Vida e Regras de Negócio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NUVEMSHOP_STORE_ID', '8179726');
    vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', 'token-test');

    vi.mocked(prisma.loja.findFirst).mockResolvedValue(mockLoja as never);
    vi.mocked(prisma.loja.findMany).mockResolvedValue([mockLoja] as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as never);
    vi.mocked(prisma.categoryTag.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.categoryTag.create).mockResolvedValue({ id: 'tag-1', slug: 'cosmeticos' } as never);
    vi.mocked(prisma.categoryTag.findMany).mockResolvedValue([{ id: 'tag-1' }] as never);
  });

  it('ingere produto simples sem atributos aplicando "Único" e "Padrão" com stockBuffer = 1', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.product.create).mockResolvedValue({
      id: 'prod-new-1',
      name: 'Batom Matte',
      stock: 0,
      stockBuffer: 1,
      productVariants: [],
    } as never);
    vi.mocked(prisma.product.update).mockResolvedValue({ id: 'prod-new-1' } as never);

    const mockCaller = {
      getProduct: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: '8811',
          name: 'Batom Matte',
          price: '49.90',
          variants: [
            {
              id: 'var-8811-1',
              sku: 'BAT-01',
              price: '49.90',
              stock: 5,
              values: [],
            },
          ],
        },
      }),
    };

    const result = await ingestProductFromNuvemshop(
      { storeId: '8179726', productId: '8811', event: 'product/created' },
      { caller: mockCaller }
    );

    expect(result.status).toBe('INGESTED');
    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Batom Matte',
          stockBuffer: 1,
          lojaID: 'loja-uuid-123',
          nuvemshopProductId: '8811',
        }),
      })
    );

    expect(prisma.productVariants.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          size: 'Único',
          color: 'Padrão',
          stock: 5,
          nuvemshopVariantId: 'var-8811-1',
        }),
      })
    );
  });

  it('retém produto incompleto (preço zero) em Quarentena Operacional', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.product.create).mockResolvedValue({
      id: 'prod-quarantine-1',
      name: 'Item em Cadastro',
      stock: 0,
      stockBuffer: 0,
      productVariants: [],
    } as never);
    vi.mocked(prisma.product.update).mockResolvedValue({ id: 'prod-quarantine-1' } as never);

    const mockCaller = {
      getProduct: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: '8822',
          name: 'Item em Cadastro',
          price: '0.00',
          variants: [{ id: 'var-8822-1', price: '0.00', stock: 10, values: [] }],
        },
      }),
    };

    const result = await ingestProductFromNuvemshop(
      { storeId: '8179726', productId: '8822', event: 'product/created' },
      { caller: mockCaller }
    );

    expect(result.status).toBe('QUARANTINE');
    expect(result.isQuarantine).toBe(true);
    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockBuffer: 0,
        }),
      })
    );
  });

  it('gerencia transição de produto simples para grade de variações aposentando a neutra', async () => {
    const existingProductWithNeutral = {
      id: 'prod-transition',
      lojaID: 'loja-uuid-123',
      nuvemshopProductId: '8833',
      stock: 5,
      catalogVersion: 1,
      productVariants: [
        {
          id: 'v-neutral-id',
          size: 'Único',
          color: 'Padrão',
          stock: 5,
          nuvemshopVariantId: 'v-remote-old',
          retiredAt: null,
        },
      ],
    };

    vi.mocked(prisma.product.findFirst).mockResolvedValue(existingProductWithNeutral as never);
    vi.mocked(prisma.product.update).mockResolvedValue(existingProductWithNeutral as never);

    const mockCaller = {
      getProduct: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: '8833',
          name: 'Camisa Polo',
          price: '99.00',
          attributes: [{ pt: 'Tamanho' }],
          variants: [
            { id: 'v-p', sku: 'POLO-P', stock: 3, values: ['P'] },
            { id: 'v-m', sku: 'POLO-M', stock: 4, values: ['M'] },
          ],
        },
      }),
    };

    const result = await ingestProductFromNuvemshop(
      { storeId: '8179726', productId: '8833', event: 'product/updated' },
      { caller: mockCaller }
    );

    expect(result.status).toBe('UPDATED');

    // Aposenta a variante neutra antiga e limpa o nuvemshopVariantId
    expect(prisma.productVariants.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-neutral-id' },
        data: expect.objectContaining({
          retiredAt: expect.any(Date),
          stock: 0,
          nuvemshopVariantId: null,
        }),
      })
    );

    // Cria as novas variantes da grade
    expect(prisma.productVariants.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          size: 'P',
          nuvemshopVariantId: 'v-p',
        }),
      })
    );
  });

  it('reativa ("un-retire") produto previamente aposentado se ele for recadastrado no ERP', async () => {
    const retiredProduct = {
      id: 'prod-retired',
      lojaID: 'loja-uuid-123',
      nuvemshopProductId: '8844',
      stock: 0,
      retiredAt: new Date('2026-01-01'),
      productVariants: [
        {
          id: 'var-retired',
          size: 'Único',
          color: 'Padrão',
          stock: 0,
          nuvemshopVariantId: 'v-8844',
          retiredAt: new Date('2026-01-01'),
        },
      ],
    };

    vi.mocked(prisma.product.findFirst).mockResolvedValue(retiredProduct as never);
    vi.mocked(prisma.product.update).mockResolvedValue({ ...retiredProduct, retiredAt: null } as never);

    const mockCaller = {
      getProduct: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: '8844',
          name: 'Produto Reativado',
          price: '80.00',
          variants: [{ id: 'v-8844', stock: 8, values: [] }],
        },
      }),
    };

    const result = await ingestProductFromNuvemshop(
      { storeId: '8179726', productId: '8844', event: 'product/created' },
      { caller: mockCaller }
    );

    expect(result.status).toBe('UPDATED');
    // Produto tem retiredAt limpo para null
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-retired' },
        data: expect.objectContaining({
          retiredAt: null,
        }),
      })
    );
    // Variante tem retiredAt limpo para null e estoque restaurado
    expect(prisma.productVariants.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'var-retired' },
        data: expect.objectContaining({
          retiredAt: null,
          stock: 8,
        }),
      })
    );
  });

  it('aposenta em cascata no evento product/deleted sem chamar método destrutivo', async () => {
    const productToDelete = {
      id: 'prod-to-delete',
      nuvemshopProductId: '8855',
      productVariants: [{ id: 'v-1' }, { id: 'v-2' }],
    };

    vi.mocked(prisma.product.findFirst).mockResolvedValue(productToDelete as never);

    const result = await ingestProductFromNuvemshop(
      { storeId: '8179726', productId: '8855', event: 'product/deleted' }
    );

    expect(result.status).toBe('RETIRED');
    expect(prisma.productVariants.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ProductID: 'prod-to-delete' },
        data: expect.objectContaining({
          retiredAt: expect.any(Date),
          stock: 0,
        }),
      })
    );
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-to-delete' },
        data: expect.objectContaining({
          retiredAt: expect.any(Date),
          stock: 0,
        }),
      })
    );
    expect(prisma.inventoryReservation.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId: 'prod-to-delete',
          status: 'RESERVED',
        },
      })
    );
  });
});

describe('Worker Outbox - Integração do Comando NUVEMSHOP_PRODUCT_INGEST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drena comando NUVEMSHOP_PRODUCT_INGEST com sucesso no outbox', async () => {
    const { claimWork, completeWork } = await import('@/services/payment/durable-work.service');
    vi.mocked(claimWork).mockResolvedValueOnce({ ids: ['outbox-1'], owner: 'test-worker' });

    vi.mocked(prisma.commerceOutbox.findUniqueOrThrow).mockResolvedValue({
      id: 'outbox-1',
      commandType: 'NUVEMSHOP_PRODUCT_INGEST',
      aggregateId: '9999',
      payload: {
        storeId: '8179726',
        productId: '9999',
        event: 'product/created',
      },
    } as never);

    const mockProductCaller = {
      getProduct: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: '9999',
          name: 'Item Teste Outbox',
          price: '50.00',
          variants: [{ id: 'v-9999', stock: 2, values: [] }],
        },
      }),
    };

    vi.mocked(prisma.loja.findFirst).mockResolvedValue(mockLoja as never);
    vi.mocked(prisma.loja.findMany).mockResolvedValue([mockLoja] as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as never);
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.product.create).mockResolvedValue({
      id: 'prod-outbox-1',
      stock: 0,
      productVariants: [],
    } as never);
    vi.mocked(prisma.product.update).mockResolvedValue({ id: 'prod-outbox-1' } as never);

    const summary = await drainNuvemshopOutbox(10, undefined, mockProductCaller);

    expect(summary.completed).toBe(1);
    expect(completeWork).toHaveBeenCalledWith(expect.anything(), 'CommerceOutbox', 'outbox-1', 'test-worker');
  });
});
