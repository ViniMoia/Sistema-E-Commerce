import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  reconcileProductStockFromNuvemshop,
  type NuvemshopProductReaderCaller,
} from '@/lib/integrations/nuvemshop-stock-sync';
import prisma from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (work) => work(prisma)),
    product: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    productVariants: {
      update: vi.fn(),
    },
    stockSyncLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/commerce/locks', () => ({
  CommerceLocks: class {
    acquire = vi.fn().mockResolvedValue([]);
  },
}));

const mockLocalProduct = {
  id: 'prod-local-1',
  lojaID: 'loja-1',
  stock: 10,
  catalogVersion: 1,
  nuvemshopProductId: '12345',
  retiredAt: null,
  productVariants: [
    {
      id: 'var-local-1',
      ProductID: 'prod-local-1',
      nuvemshopVariantId: '98761',
      stock: 4,
      sku: 'SKU-01',
      retiredAt: null,
    },
    {
      id: 'var-local-2',
      ProductID: 'prod-local-1',
      nuvemshopVariantId: '98762',
      stock: 6,
      sku: 'SKU-02',
      retiredAt: null,
    },
  ],
};

const mockRemoteProduct = {
  id: '12345',
  published: true,
  visibility: 'visible',
  variants: [
    {
      id: '98761',
      product_id: '12345',
      sku: 'SKU-01',
      stock: 7, // Changed from 4 to 7
    },
    {
      id: '98762',
      product_id: '12345',
      sku: 'SKU-02',
      stock: 6, // Unchanged
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NUVEMSHOP_STORE_ID', '8179726');
  vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', 'token-abc');

  vi.mocked(prisma.product.findFirst).mockResolvedValue(structuredClone(mockLocalProduct) as never);
  vi.mocked(prisma.product.update).mockResolvedValue({} as never);
  vi.mocked(prisma.productVariants.update).mockResolvedValue({} as never);
  vi.mocked(prisma.stockSyncLog.create).mockResolvedValue({} as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Nuvemshop Stock Reconciliation', () => {
  it('skips reconciliation if credentials are missing', async () => {
    vi.stubEnv('NUVEMSHOP_STORE_ID', '');
    const result = await reconcileProductStockFromNuvemshop('12345');
    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toBe('NUVEMSHOP_CREDENTIALS_MISSING');
  });

  it('returns ERROR when remote GET returns HTTP error', async () => {
    const caller: NuvemshopProductReaderCaller = {
      getProduct: vi.fn().mockResolvedValue({
        success: false,
        status: 404,
        error: 'HTTP_404',
      }),
    };

    const result = await reconcileProductStockFromNuvemshop('12345', { caller });
    expect(result.status).toBe('ERROR');
    expect(result.reason).toBe('HTTP_404');
  });

  it('returns ERROR when remote data fails schema validation', async () => {
    const caller: NuvemshopProductReaderCaller = {
      getProduct: vi.fn().mockResolvedValue({
        success: true,
        data: { broken: 'schema' },
        status: 200,
      }),
    };

    const result = await reconcileProductStockFromNuvemshop('12345', { caller });
    expect(result.status).toBe('ERROR');
    expect(result.reason).toBe('INVALID_REMOTE_PRODUCT_SCHEMA');
  });

  it('returns NOT_FOUND if product does not exist in local catalog', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null);

    const caller: NuvemshopProductReaderCaller = {
      getProduct: vi.fn().mockResolvedValue({
        success: true,
        data: mockRemoteProduct,
        status: 200,
      }),
    };

    const result = await reconcileProductStockFromNuvemshop('12345', { caller });
    expect(result.status).toBe('NOT_FOUND');
    expect(result.reason).toBe('LOCAL_PRODUCT_NOT_LINKED');
  });

  it('successfully updates changed variant, updates parent stock, and logs audit', async () => {
    const caller: NuvemshopProductReaderCaller = {
      getProduct: vi.fn().mockResolvedValue({
        success: true,
        data: mockRemoteProduct,
        status: 200,
      }),
    };

    const result = await reconcileProductStockFromNuvemshop('12345', {
      caller,
      eventId: 'evt-test-1',
      source: 'WEBHOOK',
    });

    expect(result.status).toBe('RECONCILED');
    expect(result.productId).toBe('prod-local-1');
    expect(result.updatedVariantsCount).toBe(1);

    // Only variant 1 changed from 4 to 7
    expect(prisma.productVariants.update).toHaveBeenCalledTimes(1);
    expect(prisma.productVariants.update).toHaveBeenCalledWith({
      where: { id: 'var-local-1' },
      data: { stock: 7 },
    });

    // StockSyncLog audit created
    expect(prisma.stockSyncLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.stockSyncLog.create).toHaveBeenCalledWith({
      data: {
        lojaID: 'loja-1',
        productId: 'prod-local-1',
        variantId: 'var-local-1',
        sku: 'SKU-01',
        source: 'WEBHOOK',
        previousStock: 4,
        newStock: 7,
        nuvemshopEventId: 'evt-test-1',
        metadata: {
          remoteProductId: '12345',
          remoteVariantId: '98761',
        },
      },
    });

    // Parent product stock updated to 7 + 6 = 13
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-local-1' },
      data: {
        stock: 13,
        catalogVersion: { increment: 1 },
      },
    });
  });

  it('does not create audit log if remote stock is identical', async () => {
    const unchangedRemote = {
      ...mockRemoteProduct,
      variants: [
        { id: '98761', product_id: '12345', stock: 4 },
        { id: '98762', product_id: '12345', stock: 6 },
      ],
    };

    const caller: NuvemshopProductReaderCaller = {
      getProduct: vi.fn().mockResolvedValue({
        success: true,
        data: unchangedRemote,
        status: 200,
      }),
    };

    const result = await reconcileProductStockFromNuvemshop('12345', { caller });
    expect(result.status).toBe('RECONCILED');
    expect(result.updatedVariantsCount).toBe(0);
    expect(prisma.productVariants.update).not.toHaveBeenCalled();
    expect(prisma.stockSyncLog.create).not.toHaveBeenCalled();
  });
});
