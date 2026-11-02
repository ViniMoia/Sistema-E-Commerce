import prisma from '@/lib/prisma';
import { CommerceLocks } from '@/lib/commerce/locks';
import { orderCustomer, snapshotDeliveryAddress, buyerSelect } from '@/lib/commerce/order-buyer';
import { logger } from '@/lib/logger';

export interface NuvemshopOrderSyncCaller {
  createOrder(storeId: string, accessToken: string, payload: unknown, userAgent?: string): Promise<{
    success: boolean;
    data?: { id: number | string };
    status?: number;
    error?: string;
  }>;
}

export const defaultNuvemshopCaller: NuvemshopOrderSyncCaller = {
  async createOrder(storeId: string, accessToken: string, payload: unknown, userAgent?: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`https://api.nuvemshop.com.br/v1/${storeId}/orders`, {
        method: 'POST',
        headers: {
          'Authentication': `bearer ${accessToken}`,
          'User-Agent': userAgent || process.env.NUVEMSHOP_USER_AGENT || 'Continental-Ecommerce (contato@continentalestetica.com.br)',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json() as { id: number | string };
        return { success: true, data, status: response.status };
      }

      const status = response.status;
      let errorMsg = `HTTP_${status}`;
      try {
        const errorJson = await response.json() as { description?: string; message?: string };
        errorMsg = errorJson.description || errorJson.message || errorMsg;
      } catch {
        // Fallback to status
      }
      return { success: false, status, error: errorMsg };
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return { success: false, status: isAbort ? 408 : 500, error: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR' };
    }
  },
};

export interface ExportOrderOptions {
  caller?: NuvemshopOrderSyncCaller;
  inventoryBehaviour?: 'bypass' | 'claim';
}

export interface ExportOrderResult {
  status: 'SYNCED' | 'ALREADY_SYNCED' | 'SKIPPED' | 'REVIEW_REQUIRED' | 'RETRY_REQUIRED';
  nuvemshopOrderId?: string;
  reason?: string;
}

/**
 * Exports a confirmed paid order to Nuvemshop.
 * Captures snapshot and validates invariants under order lock.
 * Network I/O is performed OUTSIDE the database lock.
 * Updates syncStatus and nuvemshopOrderId transactionally.
 */
export async function exportOrderToNuvemshop(
  orderId: string,
  options: ExportOrderOptions = {}
): Promise<ExportOrderResult> {
  const caller = options.caller ?? defaultNuvemshopCaller;

  // 1. Feature Flag / Safety Check
  const syncEnabled = process.env.NUVEMSHOP_SYNC_ENABLED === 'true' || options.caller !== undefined;
  if (!syncEnabled) {
    return { status: 'SKIPPED', reason: 'NUVEMSHOP_SYNC_DISABLED' };
  }

  // 2. Snapshot & Invariants Phase (Under Commerce Lock)
  const prepared = await prisma.$transaction(async tx => {
    const locks = new CommerceLocks(tx);
    await locks.acquire('order', [orderId]);

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            variant: { select: { id: true, nuvemshopVariantId: true, retiredAt: true } },
            product: { select: { id: true, nuvemshopProductId: true } },
          },
        },
        buyer: { select: buyerSelect },
        user: { select: { id: true, name: true, email: true, phone: true, cpfCnpj: true } },
        address: true,
        loja: { select: { id: true, nuvemshopStoreId: true, nuvemshopAccessToken: true, nuvemshopUserAgent: true } },
      },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    // Idempotency: Already synced
    if (order.syncStatus === 'SYNCED' && order.nuvemshopOrderId) {
      return { outcome: 'ALREADY_SYNCED' as const, nuvemshopOrderId: order.nuvemshopOrderId };
    }

    // Only export orders that have confirmed payment
    if (!['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
      return { outcome: 'SKIPPED' as const, reason: 'ORDER_NOT_PAID' };
    }

    const storeId = order.loja.nuvemshopStoreId || process.env.NUVEMSHOP_STORE_ID;
    const accessToken = order.loja.nuvemshopAccessToken || process.env.NUVEMSHOP_ACCESS_TOKEN;
    const userAgent = order.loja.nuvemshopUserAgent || process.env.NUVEMSHOP_USER_AGENT;

    if (!storeId || !accessToken) {
      await tx.order.update({
        where: { id: orderId },
        data: { syncStatus: 'FAILED', lastSyncError: 'NUVEMSHOP_CREDENTIALS_MISSING' },
      });
      return { outcome: 'REVIEW_REQUIRED' as const, reason: 'NUVEMSHOP_CREDENTIALS_MISSING' };
    }

    // Verify all items have persisted Nuvemshop variant bindings
    const unmappedItem = order.items.find(
      item => !item.productVariantsId || !item.variant?.nuvemshopVariantId
    );
    if (unmappedItem) {
      await tx.order.update({
        where: { id: orderId },
        data: { syncStatus: 'FAILED', lastSyncError: 'ORDER_ITEM_VARIANT_NOT_MAPPED' },
      });
      return { outcome: 'REVIEW_REQUIRED' as const, reason: 'ORDER_ITEM_VARIANT_NOT_MAPPED' };
    }

    const customer = orderCustomer(order);
    const nameParts = (customer.name || 'Cliente').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const deliveryAddress = order.address ?? snapshotDeliveryAddress(order.buyer);
    const billingAddress = deliveryAddress ? {
      first_name: firstName,
      last_name: lastName,
      address: deliveryAddress.street,
      number: deliveryAddress.number,
      floor: deliveryAddress.complement || undefined,
      locality: deliveryAddress.district || undefined,
      city: deliveryAddress.city,
      state: deliveryAddress.state,
      zipcode: deliveryAddress.cep.replace(/\D/g, ''),
      country: 'BR',
      phone: customer.phone ? customer.phone.replace(/\D/g, '') : undefined,
    } : undefined;

    const inventoryBehaviour = options.inventoryBehaviour ??
      (process.env.NUVEMSHOP_INVENTORY_BEHAVIOUR as 'bypass' | 'claim' | undefined) ??
      'bypass';

    const payload = {
      products: order.items.map(item => ({
        variant_id: Number(item.variant!.nuvemshopVariantId),
        quantity: item.quantity,
        price: Number(item.price),
      })),
      customer: {
        name: customer.name,
        email: customer.email || 'contato@continentalestetica.com.br',
        phone: customer.phone ? customer.phone.replace(/\D/g, '') : undefined,
        identification: customer.cpfCnpj ? customer.cpfCnpj.replace(/\D/g, '') : undefined,
      },
      billing_address: billingAddress,
      shipping_address: billingAddress,
      shipping_cost_owner: Number(order.shippingCost ?? order.freightValue ?? 0),
      payment_status: 'paid',
      status: 'open',
      inventory_behaviour: inventoryBehaviour,
      note: `Pedido E-commerce #${order.orderNumber} (Ref: ${order.id})`,
      external_reference: order.id,
      send_email: false,
    };

    await tx.order.update({
      where: { id: orderId },
      data: { syncStatus: 'PROCESSING' },
    });

    return {
      outcome: 'READY_TO_DISPATCH' as const,
      storeId,
      accessToken,
      userAgent,
      payload,
    };
  });

  if (prepared.outcome === 'ALREADY_SYNCED') {
    return { status: 'ALREADY_SYNCED', nuvemshopOrderId: prepared.nuvemshopOrderId };
  }
  if (prepared.outcome === 'SKIPPED') {
    return { status: 'SKIPPED', reason: prepared.reason };
  }
  if (prepared.outcome === 'REVIEW_REQUIRED') {
    return { status: 'REVIEW_REQUIRED', reason: prepared.reason };
  }

  // 3. Remote Dispatch Phase (NO LOCK HELD)
  const response = await caller.createOrder(
    prepared.storeId,
    prepared.accessToken,
    prepared.payload,
    prepared.userAgent
  );

  // 4. Reconciliation Outcome Phase (Under Order Lock)
  return await prisma.$transaction(async tx => {
    const locks = new CommerceLocks(tx);
    await locks.acquire('order', [orderId]);

    if (response.success && response.data?.id) {
      const nuvemshopOrderId = String(response.data.id);
      await tx.order.update({
        where: { id: orderId },
        data: {
          nuvemshopOrderId,
          syncStatus: 'SYNCED',
          lastSyncError: null,
          syncAttempts: { increment: 1 },
        },
      });

      logger.info('Pedido sincronizado com sucesso na Nuvemshop.', {
        action: 'NUVEMSHOP_ORDER_SYNCED',
        orderId,
        nuvemshopOrderId,
      });

      return { status: 'SYNCED', nuvemshopOrderId };
    }

    const isFatal = response.status !== undefined && response.status >= 400 && response.status < 500 && response.status !== 429;
    const errorMessage = response.error || `HTTP_${response.status ?? 500}`;

    await tx.order.update({
      where: { id: orderId },
      data: {
        syncStatus: isFatal ? 'DEAD_LETTER' : 'FAILED',
        lastSyncError: errorMessage,
        syncAttempts: { increment: 1 },
      },
    });

    logger.warn('Falha na sincronização de pedido Nuvemshop.', {
      action: 'NUVEMSHOP_ORDER_SYNC_FAILED',
      orderId,
      status: response.status,
      isFatal,
    });

    if (isFatal) {
      return { status: 'REVIEW_REQUIRED', reason: errorMessage };
    }
    return { status: 'RETRY_REQUIRED', reason: errorMessage };
  });
}
