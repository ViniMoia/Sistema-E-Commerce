import prisma from "@/lib/prisma";
import { Prisma, OrderStatus } from "@prisma/client";
import { isValidTransition } from "@/lib/order-transitions";
import { creditEarnedPoints, refundOrderPoints } from "@/services/loyalty.service";
import type { ListOrdersParams, UpdateOrderStatusInput, UpdateStatusResult } from "@/types/admin.types";
import type { CreateOrderInput, OrderWithDetails, OrderSummary } from "@/types/order.types";

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

export async function createOrderFromCart(input: CreateOrderInput): Promise<OrderWithDetails> {
  const { userID, cartID, addressID, lojaID } = input;

  const cart = await prisma.cart.findUnique({
    where: { id: cartID },
    include: { items: true },
  });

  if (!cart) throw new OrderError("CART_NOT_FOUND");
  if (cart.userID !== userID) throw new OrderError("CART_ACCESS_DENIED");
  if (cart.status !== "ACTIVE") throw new OrderError("CART_NOT_ACTIVE");
  if (cart.items.length === 0) throw new OrderError("CART_IS_EMPTY");

  const address = await prisma.address.findUnique({ where: { id: addressID } });
  if (!address) throw new OrderError("ADDRESS_NOT_FOUND");
  if (address.userID !== userID) throw new OrderError("ADDRESS_ACCESS_DENIED");

  const subtotal = cart.items.reduce((acc, item) => {
    return acc.plus(new Prisma.Decimal(item.price).times(new Prisma.Decimal(item.quantity)));
  }, new Prisma.Decimal(0));

  const shippingCostDecimal = new Prisma.Decimal(cart.shippingCost ?? 0);
  const total = subtotal.plus(shippingCostDecimal);

  const [order] = await prisma.$transaction([
    prisma.order.create({
      data: {
        userID,
        addressID,
        lojaID,
        status: "PENDING",
        deliveryType: "DELIVERY",
        subtotal,
        shippingCost: shippingCostDecimal,
        total,
        items: {
          createMany: {
            data: cart.items.map((item) => ({
              productId: item.productID,
              productVariantsId: item.variantID,
              quantity: item.quantity,
              price: new Prisma.Decimal(item.price),
              color: item.color,
              size: item.size,
              name: item.productName,
            })),
          },
        },
      },
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
    }),
    prisma.cart.update({
      where: { id: cartID },
      data: { status: "COMPLETED" },
    }),
  ]);

  return order as unknown as OrderWithDetails;
}

export async function getOrderById(orderID: string): Promise<OrderWithDetails> {
  const order = await prisma.order.findUnique({
    where: { id: orderID },
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

export async function getOrdersByUser(userID: string): Promise<OrderSummary[]> {
  const orders = await prisma.order.findMany({
    where: { userID },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return orders as unknown as OrderSummary[];
}

export async function listOrdersForAdmin(params: ListOrdersParams) {
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
        status: true,
        total: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const hasNextPage = orders.length > pageSize;
  const data = hasNextPage ? orders.slice(0, pageSize) : orders;
  const nextCursor = hasNextPage ? data[data.length - 1].id : null;

  return { data, totalCount, nextCursor, hasNextPage };
}

export async function getOrderDetailForAdmin(
  orderIdOrParams: string | { orderId: string; lojaID?: string }
) {
  const orderId = typeof orderIdOrParams === 'string' ? orderIdOrParams : orderIdOrParams.orderId;
  const lojaID = typeof orderIdOrParams === 'string' ? undefined : orderIdOrParams.lojaID;

  return prisma.order.findFirst({
    where: {
      id: orderId,
      ...(lojaID ? { lojaID } : {}),
    },
    include: {
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
        orderBy: { createdAt: 'asc' },
        include: {
          performedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
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

export async function updateOrderStatus(
  input: UpdateOrderStatusInput & { lojaID?: string }
): Promise<UpdateStatusResult> {
  const fullOrder = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      status: true,
      userID: true,
      lojaID: true,
      subtotal: true,
      pointsEarned: true,
      pointsRedeemed: true,
      pointsDiscountValue: true,
      items: {
        select: {
          id: true,
          quantity: true,
          productVariantsId: true,
        },
      },
    },
  });

  if (!fullOrder || (input.lojaID && fullOrder.lojaID !== input.lojaID)) {
    return { success: false, error: "Pedido não encontrado.", code: "NOT_FOUND" };
  }

  if (!isValidTransition(fullOrder.status, input.newStatus)) {
    return { success: false, error: "Transição de status inválida.", code: "INVALID_TRANSITION" };
  }

  const itemsWithVariant = fullOrder.items.filter(
    (i): i is typeof i & { productVariantsId: string } => i.productVariantsId !== null
  );

  if (input.newStatus === "PAID") {
    const variantStockChecks = await prisma.productVariants.findMany({
      where: { id: { in: itemsWithVariant.map((i) => i.productVariantsId) } },
      select: { id: true, stock: true },
    });
    const stockMap = new Map(variantStockChecks.map((v) => [v.id, v.stock]));

    for (const item of itemsWithVariant) {
      const available = stockMap.get(item.productVariantsId) ?? 0;
      if (available < item.quantity) {
        return {
          success: false,
          error: `Estoque insuficiente para a variante ${item.productVariantsId}.`,
          code: "INVALID_TRANSITION",
        };
      }
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: input.orderId },
        data: { status: input.newStatus },
        select: { id: true, status: true },
      });

      for (const item of itemsWithVariant) {
        await tx.productVariants.update({
          where: { id: item.productVariantsId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: input.performedById,
          targetId: fullOrder.userID,
          action: "ORDER_STATUS_UPDATED",
          entity: "Order",
          entityId: input.orderId,
          previousValue: { status: fullOrder.status },
          newValue: { status: input.newStatus },
          ipAddress: input.ipAddress ?? null,
        },
      });

      // Hook de Fidelidade: Creditar pontos ganhos pela compra paga
      await creditEarnedPoints(
        {
          lojaID: fullOrder.lojaID,
          userID: fullOrder.userID,
          orderId: input.orderId,
          subtotal: Number(fullOrder.subtotal),
        },
        tx
      );

      return order;
    });

    return { success: true, order: updatedOrder };
  }

  if (input.newStatus === "CANCELLED") {
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: input.orderId },
        data: { status: input.newStatus },
        select: { id: true, status: true },
      });

      // Se já havia sido pago, devolve estoque
      if (fullOrder.status === "PAID") {
        for (const item of itemsWithVariant) {
          await tx.productVariants.update({
            where: { id: item.productVariantsId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: input.performedById,
          targetId: fullOrder.userID,
          action: "ORDER_STATUS_UPDATED",
          entity: "Order",
          entityId: input.orderId,
          previousValue: { status: fullOrder.status },
          newValue: { status: input.newStatus },
          ipAddress: input.ipAddress ?? null,
        },
      });

      // Hook de Fidelidade: Estornar pontos ganhos e/ou devolver pontos resgatados
      await refundOrderPoints(
        {
          lojaID: fullOrder.lojaID,
          orderId: input.orderId,
          reason: `Cancelamento do pedido #${input.orderId.slice(0, 8)}`,
        },
        tx
      );

      return order;
    });

    return { success: true, order: updatedOrder };
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: input.orderId },
      data: { status: input.newStatus },
      select: { id: true, status: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.performedById,
        targetId: fullOrder.userID,
        action: "ORDER_STATUS_UPDATED",
        entity: "Order",
        entityId: input.orderId,
        previousValue: { status: fullOrder.status },
        newValue: { status: input.newStatus },
        ipAddress: input.ipAddress ?? null,
      },
    });

    return order;
  });

  return { success: true, order: updatedOrder };
}
