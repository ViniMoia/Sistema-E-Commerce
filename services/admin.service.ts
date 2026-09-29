/**
 * @file services/admin.service.ts
 * @description Admin-scoped service layer.
 *
 * Rules:
 * - No HTTP knowledge (no NextRequest/NextResponse).
 * - All admin mutations are audited via AuditLog.
 * - updateOrderStatusAdmin wraps the domain service and maps OrderError
 *   codes to the UpdateStatusResult discriminated union.
 * - Monetary aggregations convert Prisma.Decimal → number at the boundary.
 */

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  ListOrdersParams,
  UpdateOrderStatusInput,
  UpdateStatusResult,
  ListCustomersParams,
  CustomerMetrics,
} from "@/types/admin.types";
import { updateOrderStatus } from "@/services/order.service";

// ─── Valid status transitions ─────────────────────────────────────────────────

// ─── 1. LIST ORDERS (admin) ────────────────────────────────────────────────────

export async function listOrders(params: ListOrdersParams) {
  const { pageSize = 20, status, search, dateFrom, dateTo, cursor } = params;

  const where: Prisma.OrderWhereInput = {
    ...(status && { status }),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }
      : {}),
    ...(search && {
      user: {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      },
    }),
  };

  const orders = await prisma.order.findMany({
    where,
    take: pageSize + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarImageUrl: true },
      },
      items: { select: { id: true, name: true, quantity: true, price: true } },
      address: { select: { city: true, state: true } },
    },
  });

  const hasNextPage = orders.length > pageSize;
  const page = hasNextPage ? orders.slice(0, pageSize) : orders;
  const nextCursor = hasNextPage ? page[page.length - 1].id : null;

  return { orders: page, nextCursor };
}

// ─── 2. UPDATE ORDER STATUS (admin) ───────────────────────────────────────────

export async function updateOrderStatusAdmin(
  input: UpdateOrderStatusInput & { lojaID: string }
): Promise<UpdateStatusResult> {
  return updateOrderStatus(input);
}

// ─── 3. LIST CUSTOMERS (admin) ────────────────────────────────────────────────

export async function listCustomers(params: ListCustomersParams) {
  const { pageSize = 20, search, cursor } = params;

  const where: Prisma.UserWhereInput = {
    ...(params.lojaID ? { lojaID: params.lojaID } : {}),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const customers = await prisma.user.findMany({
    where,
    take: pageSize + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarImageUrl: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });

  const hasNextPage = customers.length > pageSize;
  const page = hasNextPage ? customers.slice(0, pageSize) : customers;
  const nextCursor = hasNextPage ? page[page.length - 1].id : null;

  return { customers: page, nextCursor };
}

// ─── 4. CUSTOMER METRICS ──────────────────────────────────────────────────────

export async function getCustomerMetrics(userId: string): Promise<CustomerMetrics> {
  const [aggregate, lastOrder] = await Promise.all([
    prisma.order.aggregate({
      where: { userID: userId },
      _count: { id: true },
      _sum: { total: true },
      _avg: { total: true },
    }),
    prisma.order.findFirst({
      where: { userID: userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const totalOrders = aggregate._count.id;
  // Prisma.Decimal → number boundary conversion (flagged in schema audit)
  const totalSpent = aggregate._sum.total?.toNumber() ?? 0;
  const averageTicket = aggregate._avg.total?.toNumber() ?? 0;

  return {
    totalOrders,
    totalSpent,
    averageTicket,
    lastOrderDate: lastOrder?.createdAt ?? null,
  };
}
