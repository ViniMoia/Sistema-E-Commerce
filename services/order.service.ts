import { createOrder } from './checkout.service';
import { requirePurchaseAccount } from '@/lib/commerce/account-scope';
import { transitionOrder } from '@/lib/commerce/order-command';
import { allowedOrderActions } from '@/lib/commerce/order-fulfillment';
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { invalidateDashboardCache } from "@/services/dashboard.service";
import type { ListOrdersParams, UpdateOrderStatusInput, UpdateStatusResult } from "@/types/admin.types";
import type { CreateOrderInput, OrderWithDetails, OrderSummary, GetUserOrdersParams } from "@/types/order.types";
import { buyerSelect, orderCustomer, snapshotDeliveryAddress } from '@/lib/commerce/order-buyer';

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

/** Compatibility entry point: incomplete historical creation is retired. */
export async function createOrderFromCart(input: CreateOrderInput) {
  if (!input.checkoutIntentID || !input.acceptedRevision || !input.acceptedContentHash) throw new OrderError('CHECKOUT_INTENT_REQUIRED');
  return createOrder({ lojaID: input.lojaID, customer: { userId: input.userID, name: '', email: '', phone: '' }, items: [],
    deliveryType: 'NONE', checkoutIntentID: input.checkoutIntentID, acceptedRevision: input.acceptedRevision,
    acceptedContentHash: input.acceptedContentHash, creditCard: input.creditCard });
}

export async function getOrderById(orderID: string, scope: { userID: string; lojaID: string }): Promise<OrderWithDetails> {
  const user = await prisma.user.findUnique({ where: { id: scope.userID }, select: { lojaID: true, status: true, role: true } });
  if (!user || user.lojaID !== scope.lojaID || user.status !== 'ACTIVE') throw new OrderError('ACCOUNT_ACCESS_DENIED');
  const order = await prisma.order.findFirst({
    where: { id: orderID, lojaID: scope.lojaID, ...(user.role === 'ADMIN' ? {} : { userID: scope.userID }) },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
      address: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatarImageUrl: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!order) throw new OrderError("ORDER_NOT_FOUND");

  return order as unknown as OrderWithDetails;
}

export async function getOrdersByUser(params: GetUserOrdersParams): Promise<OrderSummary[]> {
  if (!params || !params.userID || !params.lojaID) {
    throw new OrderError("VALIDATION_ERROR");
  }
  try { await requirePurchaseAccount(prisma, params.userID, params.lojaID); }
  catch { throw new OrderError('ACCOUNT_ACCESS_DENIED'); }

  const orders = await prisma.order.findMany({
    where: {
      userID: params.userID,
      lojaID: params.lojaID,
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    ...(params.limit ? { take: params.limit } : {}),
    ...(params.skip ? { skip: params.skip } : {}),
  });

  return orders as unknown as OrderSummary[];
}

export async function listOrdersForAdmin(params: ListOrdersParams) {
  if (!params.lojaID) throw new OrderError('ACCOUNT_ACCESS_DENIED');
  const where: Prisma.OrderWhereInput = {
    ...(params.lojaID ? { lojaID: params.lojaID } : {}),
    ...(params.customerId ? { userID: params.customerId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...((params.dateFrom || params.dateTo)
      ? {
          createdAt: {
            ...(params.dateFrom ? { gte: params.dateFrom } : {}),
            ...(params.dateTo ? { lte: params.dateTo } : {}),
          },
        }
      : {}),
    ...(params.search
      ? {
          OR: [
            { user: { name: { contains: params.search, mode: "insensitive" } } },
            { user: { email: { contains: params.search, mode: "insensitive" } } },
            { buyer: { name: { contains: params.search, mode: 'insensitive' } } },
            { buyer: { email: { contains: params.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const pageSize = params.pageSize ?? 20;

  const [orders, totalCount] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      take: pageSize + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        deliveryType: true,
        freightValue: true,
        status: true,
        total: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        buyer: { select: buyerSelect },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const hasNextPage = orders.length > pageSize;
  const data = (hasNextPage ? orders.slice(0, pageSize) : orders).map(order => ({ ...order, customer: orderCustomer(order) }));
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  return { data, totalCount, nextCursor, hasNextPage };
}

export async function getOrderDetailForAdmin(
  orderIdOrParams: string | { orderId: string; lojaID?: string }
) {
  const orderId = typeof orderIdOrParams === 'string' ? orderIdOrParams : orderIdOrParams.orderId;
  const lojaID = typeof orderIdOrParams === 'string' ? undefined : orderIdOrParams.lojaID;
  if (!lojaID) throw new OrderError('ACCOUNT_ACCESS_DENIED');

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...(lojaID ? { lojaID } : {}),
    },
    include: {
      buyer: { select: buyerSelect },
      paymentAttempts: { orderBy: { number: 'desc' }, take: 1, select: { status: true, provider: true, failureCode: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
      address: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          size: true,
          color: true,
          price: true,
        },
      },
      statusHistory: {
        orderBy: [{ orderVersion: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }, { id: 'asc' }],
        include: {
          performedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!order) return null;
  const { paymentAttempts, ...detail } = order;
  return { ...detail, actions: allowedOrderActions(order, paymentAttempts[0] ?? null, 'ADMIN'), customer: orderCustomer(order), address: order.address ?? snapshotDeliveryAddress(order.buyer) };
}

export async function updateOrderNotes(params: {
  orderId: string;
  lojaID?: string;
  adminNotes: string;
}) {
  const existing = await prisma.order.findUnique({ where: { id: params.orderId } });

  if (!existing || (params.lojaID && existing.lojaID !== params.lojaID)) {
    return null;
  }

  return prisma.order.update({
    where: { id: params.orderId },
    data: { adminNotes: params.adminNotes },
  });
}

export async function updateOrderStatus(input: UpdateOrderStatusInput & { lojaID?: string }): Promise<UpdateStatusResult> {
  const result = await transitionOrder(input);
  if (result.success) {
    try {
      if (input.lojaID) invalidateDashboardCache(input.lojaID);
    } catch {
      // Committed durable event remains retryable even if immediate cache invalidation fails.
    }
  }
  return result;
}
