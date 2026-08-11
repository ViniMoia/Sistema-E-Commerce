import prisma from "@/lib/prisma";
import type { ListCustomersParams, CustomerMetrics } from "@/types/admin.types";
import type { Prisma } from "@prisma/client";

export async function listCustomers(params: ListCustomersParams) {
  const where: Prisma.UserWhereInput = {
    role: 'CUSTOMER',
    ...(params.lojaID ? { lojaID: params.lojaID } : {})
  };

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const pageSize = params.pageSize ?? 20;

  const dataRaw = await prisma.user.findMany({
    where,
    take: pageSize + 1,
    cursor: params.cursor ? { id: params.cursor } : undefined,
    skip: params.cursor ? 1 : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      _count: {
        select: { orders: true },
      },
    },
  });

  const hasNextPage = dataRaw.length > pageSize;
  const data = hasNextPage ? dataRaw.slice(0, pageSize) : dataRaw;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  return { data, hasNextPage, nextCursor };
}

export async function getCustomerProfile(customerId: string) {
  const [user, aggregate] = await prisma.$transaction([
    prisma.user.findUnique({
      where: { id: customerId, role: 'CUSTOMER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        addresses: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            total: true,
            createdAt: true,
            _count: { select: { items: true } },
          },
        },
      },
    }),
    prisma.order.aggregate({
      where: { userID: customerId, status: { not: 'CANCELLED' } },
      _count: { id: true },
      _sum: { total: true },
      _avg: { total: true },
      _max: { createdAt: true },
    }),
  ]);

  if (!user) return null;

  const metrics: CustomerMetrics = {
    totalOrders: aggregate._count.id ?? 0,
    totalSpent: Number(aggregate._sum.total ?? 0),
    averageTicket: Number(aggregate._avg.total ?? 0),
    lastOrderDate: aggregate._max.createdAt ?? null,
  };

  return { ...user, metrics };
}
