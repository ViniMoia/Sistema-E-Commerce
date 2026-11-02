import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportOrderToNuvemshop, type NuvemshopOrderSyncCaller } from '@/lib/integrations/nuvemshop-order-sync';
import prisma from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (work) => work(prisma)),
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/commerce/locks', () => ({
  CommerceLocks: class {
    acquire = vi.fn().mockResolvedValue([]);
    acquireCartOwner = vi.fn().mockResolvedValue(undefined);
  },
}));

const mockOrder = {
  id: 'order-uuid-1',
  orderNumber: 101,
  status: 'PAID',
  lojaID: 'loja-uuid-1',
  subtotal: 100,
  shippingCost: 20,
  freightValue: 20,
  financialTotal: 120,
  nuvemshopOrderId: null,
  syncStatus: 'PENDING',
  syncAttempts: 0,
  lastSyncError: null,
  loja: {
    id: 'loja-uuid-1',
    nuvemshopStoreId: '8179726',
    nuvemshopAccessToken: 'test-access-token',
    nuvemshopUserAgent: 'TestUserAgent/1.0',
  },
  user: {
    id: 'user-uuid-1',
    name: 'João da Silva',
    email: 'joao@example.com',
    phone: '81999998888',
    cpfCnpj: '12345678909',
  },
  buyer: null,
  address: {
    street: 'Rua das Flores',
    number: '123',
    complement: 'Apto 101',
    district: 'Boa Viagem',
    city: 'Recife',
    state: 'PE',
    cep: '51020-000',
  },
  items: [
    {
      id: 'item-1',
      name: 'Produto Teste',
      quantity: 2,
      price: 50,
      productVariantsId: 'variant-1',
      variant: {
        id: 'variant-1',
        nuvemshopVariantId: '1588283587',
        retiredAt: null,
      },
      product: {
        id: 'prod-1',
        nuvemshopProductId: '998877',
      },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NUVEMSHOP_SYNC_ENABLED', 'true');
  vi.stubEnv('NUVEMSHOP_STORE_ID', '8179726');
  vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', 'test-access-token');

  vi.mocked(prisma.order.findUnique).mockResolvedValue(structuredClone(mockOrder) as never);
  vi.mocked(prisma.order.update).mockResolvedValue({} as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Nuvemshop Order Outbound Sync', () => {
  it('skips export if NUVEMSHOP_SYNC_ENABLED is not true and no caller is provided', async () => {
    vi.stubEnv('NUVEMSHOP_SYNC_ENABLED', 'false');
    const result = await exportOrderToNuvemshop('order-uuid-1');
    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toBe('NUVEMSHOP_SYNC_DISABLED');
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('recognizes already synced orders idempotently without calling remote API', async () => {
    const alreadySyncedOrder = {
      ...mockOrder,
      nuvemshopOrderId: '998811',
      syncStatus: 'SYNCED',
    };
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(alreadySyncedOrder as never);

    const caller: NuvemshopOrderSyncCaller = {
      createOrder: vi.fn(),
    };

    const result = await exportOrderToNuvemshop('order-uuid-1', { caller });
    expect(result.status).toBe('ALREADY_SYNCED');
    expect(result.nuvemshopOrderId).toBe('998811');
    expect(caller.createOrder).not.toHaveBeenCalled();
  });

  it('skips orders that are not in a paid status (e.g. PENDING or CANCELLED)', async () => {
    const pendingOrder = {
      ...mockOrder,
      status: 'PENDING',
    };
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(pendingOrder as never);

    const caller: NuvemshopOrderSyncCaller = {
      createOrder: vi.fn(),
    };

    const result = await exportOrderToNuvemshop('order-uuid-1', { caller });
    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toBe('ORDER_NOT_PAID');
    expect(caller.createOrder).not.toHaveBeenCalled();
  });

  it('flags review and does not export if Nuvemshop store credentials are completely missing', async () => {
    const orderWithoutCreds = structuredClone(mockOrder);
    orderWithoutCreds.loja.nuvemshopStoreId = null as never;
    orderWithoutCreds.loja.nuvemshopAccessToken = null as never;
    vi.stubEnv('NUVEMSHOP_STORE_ID', '');
    vi.stubEnv('NUVEMSHOP_ACCESS_TOKEN', '');
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(orderWithoutCreds as never);

    const caller: NuvemshopOrderSyncCaller = {
      createOrder: vi.fn(),
    };

    const result = await exportOrderToNuvemshop('order-uuid-1', { caller });
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.reason).toBe('NUVEMSHOP_CREDENTIALS_MISSING');
    expect(caller.createOrder).not.toHaveBeenCalled();
  });

  it('strictly fails closed if any order item lacks a persisted nuvemshopVariantId', async () => {
    const orderWithUnmappedVariant = structuredClone(mockOrder);
    orderWithUnmappedVariant.items[0].variant!.nuvemshopVariantId = null as never;
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(orderWithUnmappedVariant as never);

    const caller: NuvemshopOrderSyncCaller = {
      createOrder: vi.fn(),
    };

    const result = await exportOrderToNuvemshop('order-uuid-1', { caller });
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.reason).toBe('ORDER_ITEM_VARIANT_NOT_MAPPED');
    expect(caller.createOrder).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncStatus: 'FAILED',
          lastSyncError: 'ORDER_ITEM_VARIANT_NOT_MAPPED',
        }),
      })
    );
  });

  it('successfully builds payload and updates order to SYNCED upon API success', async () => {
    const caller: NuvemshopOrderSyncCaller = {
      createOrder: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 778899 },
        status: 201,
      }),
    };

    const result = await exportOrderToNuvemshop('order-uuid-1', { caller });
    expect(result.status).toBe('SYNCED');
    expect(result.nuvemshopOrderId).toBe('778899');

    expect(caller.createOrder).toHaveBeenCalledTimes(1);
    const [calledStoreId, calledToken, calledPayload] = vi.mocked(caller.createOrder).mock.calls[0];
    expect(calledStoreId).toBe('8179726');
    expect(calledToken).toBe('test-access-token');

    const payload = calledPayload as any;
    expect(payload.payment_status).toBe('paid');
    expect(payload.status).toBe('open');
    expect(payload.inventory_behaviour).toBe('bypass');
    expect(payload.external_reference).toBe('order-uuid-1');
    expect(payload.products).toEqual([
      {
        variant_id: 1588283587,
        quantity: 2,
        price: 50,
      },
    ]);
    expect(payload.customer.name).toBe('João da Silva');
    expect(payload.customer.email).toBe('joao@example.com');
    expect(payload.billing_address.city).toBe('Recife');

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-uuid-1' },
      data: {
        nuvemshopOrderId: '778899',
        syncStatus: 'SYNCED',
        lastSyncError: null,
        syncAttempts: { increment: 1 },
      },
    });
  });

  it('respects NUVEMSHOP_INVENTORY_BEHAVIOUR when claim is requested', async () => {
    vi.stubEnv('NUVEMSHOP_INVENTORY_BEHAVIOUR', 'claim');

    const caller: NuvemshopOrderSyncCaller = {
      createOrder: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 778899 },
        status: 201,
      }),
    };

    await exportOrderToNuvemshop('order-uuid-1', { caller });
    const payload = vi.mocked(caller.createOrder).mock.calls[0][2] as any;
    expect(payload.inventory_behaviour).toBe('claim');
  });

  it('marks DEAD_LETTER when API returns a fatal 4xx error (e.g. 422)', async () => {
    const caller: NuvemshopOrderSyncCaller = {
      createOrder: vi.fn().mockResolvedValue({
        success: false,
        status: 422,
        error: 'Variant ID does not exist in store',
      }),
    };

    const result = await exportOrderToNuvemshop('order-uuid-1', { caller });
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.reason).toBe('Variant ID does not exist in store');

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-uuid-1' },
      data: {
        syncStatus: 'DEAD_LETTER',
        lastSyncError: 'Variant ID does not exist in store',
        syncAttempts: { increment: 1 },
      },
    });
  });

  it('marks FAILED and requests retry when API returns a transient error (500 or timeout)', async () => {
    const caller: NuvemshopOrderSyncCaller = {
      createOrder: vi.fn().mockResolvedValue({
        success: false,
        status: 503,
        error: 'Service Temporarily Unavailable',
      }),
    };

    const result = await exportOrderToNuvemshop('order-uuid-1', { caller });
    expect(result.status).toBe('RETRY_REQUIRED');

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-uuid-1' },
      data: {
        syncStatus: 'FAILED',
        lastSyncError: 'Service Temporarily Unavailable',
        syncAttempts: { increment: 1 },
      },
    });
  });
});
