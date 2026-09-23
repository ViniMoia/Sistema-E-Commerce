import prisma from "@/lib/prisma";
import { Prisma, OrderStatus } from "@prisma/client";
import { isValidTransition } from "@/lib/order-transitions";
import { creditEarnedPoints, refundOrderPoints } from "@/services/loyalty.service";
import { InventoryService } from "@/services/inventory.service";
import { invalidateDashboardCache } from "@/services/dashboard.service";
import type { ListOrdersParams, UpdateOrderStatusInput, UpdateStatusResult } from "@/types/admin.types";
import type { CreateOrderInput, OrderWithDetails, OrderSummary, GetUserOrdersParams } from "@/types/order.types";

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

  const [order] = await prisma.$transaction(async (tx) => {
    // Reserva atômica de estoque unificada via InventoryService (REV-001)
    await InventoryService.reserveStock(
      cart.items.map((item) => ({
        productId: item.productID,
        variantId: item.variantID,
        quantity: item.quantity,
        name: item.productName,
      })),
      tx,
      lojaID
    );

    const createdOrder = await tx.order.create({
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
    });

    await tx.cart.update({
      where: { id: cartID },
      data: { status: "COMPLETED" },
    });

    return [createdOrder];
  });

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

export async function getOrdersByUser(params: GetUserOrdersParams): Promise<OrderSummary[]> {
  if (!params || !params.userID || !params.lojaID) {
    throw new OrderError("VALIDATION_ERROR");
  }

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
        orderNumber: true,
        deliveryType: true,
        freightValue: true,
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
          productId: true,
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

  const isSystemActor =
    input.performedById === "ASAAS_GATEWAY" ||
    input.performedById === "SYSTEM" ||
    input.performedById === "CHECKOUT_PAYMENT_FAILURE" ||
    input.performedById === "ASAAS_GATEWAY_EXPIRATION" ||
    input.performedById?.startsWith("SYSTEM_") ||
    input.performedById?.startsWith("ASAAS_");
  const effectiveActorId = isSystemActor ? fullOrder.userID : input.performedById;
  const auditMetadata = isSystemActor ? { triggeredBy: input.performedById } : undefined;

  if (input.newStatus === "PAID") {
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const paidTimestamp = input.paidAt ? new Date(input.paidAt) : new Date();
      const order = await tx.order.update({
        where: { id: input.orderId },
        data: {
          status: input.newStatus,
          paidAt: paidTimestamp,
        },
        select: { id: true, status: true },
      });

      // Nota Arquitetural (REV-001): O estoque JÁ FOI reservado no ato do checkout (createOrder).
      // Portanto, a transição para PAID é puramente confirmatória e NUNCA deve decrementar novamente.

      await tx.auditLog.create({
        data: {
          actorId: effectiveActorId,
          targetId: fullOrder.userID,
          action: "ORDER_STATUS_UPDATED",
          entity: "Order",
          entityId: input.orderId,
          previousValue: { status: fullOrder.status },
          newValue: { status: input.newStatus },
          ipAddress: input.ipAddress ?? null,
          metadata: auditMetadata,
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

    invalidateDashboardCache(fullOrder.lojaID);
    return { success: true, order: updatedOrder };
  }

  if (input.newStatus === "CANCELLED") {
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: input.orderId },
        data: { status: input.newStatus },
        select: { id: true, status: true },
      });

      // Se o pedido estava PENDING ou PAID, estorna integralmente o estoque reservado (REV-001)
      if (fullOrder.status === "PENDING" || fullOrder.status === "PAID") {
        await InventoryService.restoreStock(
          fullOrder.items.map((item) => ({
            productId: item.productId ?? "",
            variantId: item.productVariantsId,
            quantity: item.quantity,
          })),
          tx
        );
      }

      await tx.auditLog.create({
        data: {
          actorId: effectiveActorId,
          targetId: fullOrder.userID,
          action: "ORDER_STATUS_UPDATED",
          entity: "Order",
          entityId: input.orderId,
          previousValue: { status: fullOrder.status },
          newValue: { status: input.newStatus },
          ipAddress: input.ipAddress ?? null,
          metadata: auditMetadata,
        },
      });

      // Se o pedido estava pago OU se era um pedido pendente que resgatou pontos, estorna no ledger (AUD-002)
      const hasPointsToRefund =
        fullOrder.status === "PAID" ||
        (fullOrder.status === "PENDING" && (fullOrder.pointsRedeemed ?? 0) > 0);

      if (hasPointsToRefund) {
        await refundOrderPoints(
          {
            lojaID: fullOrder.lojaID,
            orderId: input.orderId,
            reason: (input as any).reason || `Cancelamento do pedido #${input.orderId.slice(0, 8)}`,
          },
          tx
        );
      }

      return order;
    });

    invalidateDashboardCache(fullOrder.lojaID);
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
        actorId: effectiveActorId,
        targetId: fullOrder.userID,
        action: "ORDER_STATUS_UPDATED",
        entity: "Order",
        entityId: input.orderId,
        previousValue: { status: fullOrder.status },
        newValue: { status: input.newStatus },
        ipAddress: input.ipAddress ?? null,
        metadata: auditMetadata,
      },
    });

    return order;
  });

  invalidateDashboardCache(fullOrder.lojaID);
  return { success: true, order: updatedOrder };
}
