import prisma from "@/lib/prisma";
import { Prisma, OrderStatus } from "@prisma/client";
import { isValidTransition } from "@/lib/order-transitions";
import { creditEarnedPoints, refundOrderPoints } from "@/services/loyalty.service";
import { InventoryService } from "@/services/inventory.service";
import { invalidateDashboardCache } from "@/services/dashboard.service";
import { logger } from "@/lib/logger";
import type { ListOrdersParams, UpdateOrderStatusInput, UpdateStatusResult } from "@/types/admin.types";
import type {
  CreateOrderInput,
  OrderWithDetails,
  OrderSummary,
  GetUserOrdersParams,
  UserOrder,
} from "@/types/order.types";

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
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
      refundIntents: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          amount: true,
          kind: true,
          status: true,
          providerStatus: true,
          createdAt: true,
          confirmedAt: true,
          lastErrorCode: true,
        },
      },
    },
  });
}

export async function updateOrderNotes(params: {
  orderId: string;
  lojaID: string;
  actorId: string;
  adminNotes: string | null;
  ipAddress?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { id: params.orderId } });
    if (!existing || existing.lojaID !== params.lojaID) return null;

    const updated = await tx.order.update({
      where: { id: params.orderId },
      data: { adminNotes: params.adminNotes },
    });
    await tx.auditLog.create({
      data: {
        action: "ORDER_ADMIN_NOTES_UPDATED",
        actorId: params.actorId,
        targetId: existing.userID,
        entity: "Order",
        entityId: params.orderId,
        previousValue: { present: Boolean(existing.adminNotes), length: existing.adminNotes?.length ?? 0 },
        newValue: { present: Boolean(params.adminNotes), length: params.adminNotes?.length ?? 0 },
        ipAddress: params.ipAddress ?? null,
        metadata: { lojaID: params.lojaID, contentRedacted: true },
      },
    });
    return updated;
  });
}

export async function updateOrderTracking(params: {
  orderId: string;
  lojaID: string;
  actorId: string;
  trackingCode: string | null;
  ipAddress?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { id: params.orderId } });
    if (!existing || existing.lojaID !== params.lojaID) return null;

    const updated = await tx.order.update({
      where: { id: params.orderId },
      data: { trackingCode: params.trackingCode },
    });
    await tx.auditLog.create({
      data: {
        action: "ORDER_TRACKING_UPDATED",
        actorId: params.actorId,
        targetId: existing.userID,
        entity: "Order",
        entityId: params.orderId,
        previousValue: { trackingCode: existing.trackingCode },
        newValue: { trackingCode: params.trackingCode },
        ipAddress: params.ipAddress ?? null,
        metadata: { lojaID: params.lojaID },
      },
    });
    return updated;
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
      deliveryType: true,
      subtotal: true,
      pointsEarned: true,
      pointsRedeemed: true,
      pointsDiscountValue: true,
      asaasPaymentStatus: true,
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

  if (
    !fullOrder ||
    (input.lojaID && fullOrder.lojaID !== input.lojaID) ||
    (input.expectedUserID && fullOrder.userID !== input.expectedUserID)
  ) {
    return { success: false, error: "Pedido não encontrado.", code: "NOT_FOUND" };
  }

  // Um cancelamento local não equivale a um estorno financeiro. Enquanto não
  // houver comando de refund no gateway, somente o adaptador que recebeu a
  // confirmação autenticada do estorno pode concluir PAID -> CANCELLED.
  if (
    fullOrder.status === "PAID" &&
    input.newStatus === "CANCELLED" &&
    !input.paymentRefundConfirmed
  ) {
    return {
      success: false,
      error: "Pedido pago exige estorno confirmado antes do cancelamento.",
      code: "REFUND_REQUIRED",
    };
  }

  const disputedPaymentStatuses = [
    "RECEIVED_IN_CASH_UNDONE",
    "CHARGEBACK_REQUESTED",
    "CHARGEBACK_DISPUTE",
    "AWAITING_CHARGEBACK_REVERSAL",
    "DUNNING_REQUESTED",
    "DUNNING_RECEIVED",
  ];
  if (
    input.paymentRefundConfirmed &&
    fullOrder.asaasPaymentStatus &&
    disputedPaymentStatuses.includes(fullOrder.asaasPaymentStatus)
  ) {
    return {
      success: false,
      error: "Evento financeiro concorrente exige revisao manual.",
      code: "FINANCIAL_REVIEW_REQUIRED",
    };
  }

  if (!isValidTransition(fullOrder.status, input.newStatus, fullOrder.deliveryType)) {
    return { success: false, error: "Transição de status inválida.", code: "INVALID_TRANSITION" };
  }

  const isSystemActor =
    input.performedById === "ASAAS_GATEWAY" ||
    input.performedById === "SYSTEM" ||
    input.performedById === "CHECKOUT_PAYMENT_FAILURE" ||
    input.performedById === "ASAAS_GATEWAY_EXPIRATION" ||
    input.performedById?.startsWith("SYSTEM_") ||
    input.performedById?.startsWith("ASAAS_");
  const effectiveActorId = isSystemActor ? fullOrder.userID : input.performedById;
  const auditMetadata = isSystemActor ? { triggeredBy: input.performedById } : undefined;
  const deliveredConfirmedAt = input.deliveredConfirmedById ? new Date() : undefined;

  const transitionData = (extra: Prisma.OrderUpdateManyMutationInput = {}) => ({
    status: input.newStatus,
    ...(input.newStatus === "SHIPPED" && input.trackingCode !== undefined
      ? { trackingCode: input.trackingCode }
      : {}),
    ...(input.newStatus === "DELIVERED" && input.deliveredConfirmedById
      ? {
          deliveredConfirmedAt,
          deliveredConfirmedBy: input.deliveredConfirmedById,
        }
      : {}),
    ...extra,
  });

  const claimTransition = async (
    tx: Prisma.TransactionClient,
    data: Prisma.OrderUpdateManyMutationInput
  ) => {
    const claimed = await tx.order.updateMany({
      where: {
        id: input.orderId,
        status: fullOrder.status,
        ...(input.lojaID ? { lojaID: input.lojaID } : {}),
        ...(input.expectedUserID ? { userID: input.expectedUserID } : {}),
        ...(input.paymentRefundConfirmed
          ? {
              OR: [
                { asaasPaymentStatus: null },
                { asaasPaymentStatus: { notIn: disputedPaymentStatuses } },
              ],
            }
          : {}),
      },
      data,
    });

    if (claimed.count !== 1) {
      throw new OrderError("ORDER_STATUS_CONFLICT");
    }

    return {
      id: input.orderId,
      status: input.newStatus,
      ...(deliveredConfirmedAt ? { deliveredConfirmedAt } : {}),
    };
  };

  const recordTransition = async (tx: Prisma.TransactionClient) => {
    await tx.orderStatusHistory.create({
      data: {
        orderId: input.orderId,
        status: input.newStatus,
        performedById: effectiveActorId,
        ipAddress: input.ipAddress ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: effectiveActorId,
        targetId: fullOrder.userID,
        action: input.deliveredConfirmedById
          ? "ORDER_DELIVERY_CONFIRMED_BY_CUSTOMER"
          : "ORDER_STATUS_UPDATED",
        entity: "Order",
        entityId: input.orderId,
        previousValue: { status: fullOrder.status },
        newValue: {
          status: input.newStatus,
          ...(input.newStatus === "SHIPPED" && input.trackingCode !== undefined
            ? { trackingCode: input.trackingCode }
            : {}),
        },
        ipAddress: input.ipAddress ?? null,
        metadata: auditMetadata,
      },
    });
  };

  const transitionConflict = (error: unknown): UpdateStatusResult | null =>
    error instanceof OrderError && error.message === "ORDER_STATUS_CONFLICT"
      ? {
          success: false,
          error: "O pedido foi alterado por outra operação. Recarregue o estado atual.",
          code: "CONFLICT",
        }
      : null;

  if (input.newStatus === "PAID") {
    try {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        const paidTimestamp = input.paidAt ? new Date(input.paidAt) : new Date();
        const order = await claimTransition(tx, transitionData({
          paidAt: paidTimestamp,
        }));

      // Nota Arquitetural (REV-001): O estoque JÁ FOI reservado no ato do checkout (createOrder).
      // Portanto, a transição para PAID é puramente confirmatória e NUNCA deve decrementar novamente.

      await recordTransition(tx);

      // Hook de Fidelidade: Creditar pontos ganhos pela compra paga
      await creditEarnedPoints(
        {
          lojaID: fullOrder.lojaID,
          userID: fullOrder.userID,
          orderId: input.orderId,
          subtotal: Number(fullOrder.subtotal),
          points: fullOrder.pointsEarned,
        },
        tx
      );

        return order;
      });

      invalidateDashboardCache(fullOrder.lojaID);
      logger.info("Efeitos de pagamento confirmados na transacao local", {
        action: "PAYMENT_EFFECTS_COMMITTED",
        orderId: input.orderId,
        tenantId: fullOrder.lojaID,
        status: input.newStatus,
        pointsEarned: fullOrder.pointsEarned,
      });
      return { success: true, order: updatedOrder };
    } catch (error) {
      const conflict = transitionConflict(error);
      if (conflict) return conflict;
      throw error;
    }
  }

  if (input.newStatus === "CANCELLED") {
    try {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        const order = await claimTransition(tx, transitionData());

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

      await recordTransition(tx);

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
      logger.info("Efeitos de cancelamento confirmados na transacao local", {
        action: "ORDER_CANCELLATION_EFFECTS_COMMITTED",
        orderId: input.orderId,
        tenantId: fullOrder.lojaID,
        status: input.newStatus,
        inventoryRestored: fullOrder.status === "PENDING" || fullOrder.status === "PAID",
        loyaltyRefunded:
          fullOrder.status === "PAID" ||
          (fullOrder.status === "PENDING" && (fullOrder.pointsRedeemed ?? 0) > 0),
      });
      return { success: true, order: updatedOrder };
    } catch (error) {
      const conflict = transitionConflict(error);
      if (conflict) return conflict;
      throw error;
    }
  }

  try {
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await claimTransition(tx, transitionData());
      await recordTransition(tx);

      return order;
    });

    invalidateDashboardCache(fullOrder.lojaID);
    return { success: true, order: updatedOrder };
  } catch (error) {
    const conflict = transitionConflict(error);
    if (conflict) return conflict;
    throw error;
  }
}

/** Projeção canônica usada pelo histórico de pedidos no perfil. */
export async function getUserOrderHistory(
  userID: string,
  limit = 10,
  skip = 0,
  lojaID?: string
): Promise<UserOrder[]> {
  try {
    const orders = await prisma.order.findMany({
      where: {
        userID,
        ...(lojaID ? { lojaID } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        trackingCode: true,
        deliveryType: true,
        shippingServiceName: true,
        deliveredConfirmedAt: true,
        items: {
          select: {
            name: true,
            price: true,
            quantity: true,
            color: true,
            size: true,
            product: { select: { imageUrl: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      skip,
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
      trackingCode: order.trackingCode,
      deliveryType: order.deliveryType,
      shippingServiceName: order.shippingServiceName,
      deliveredConfirmedAt: order.deliveredConfirmedAt,
      items: order.items.map((item) => ({
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        color: item.color,
        size: item.size,
        imageUrl: item.product?.imageUrl || null,
      })),
    }));
  } catch (error) {
    logger.error("Falha ao consultar histórico de pedidos", error, {
      action: "ORDER_HISTORY_QUERY_FAILED",
    });
    throw new OrderError("ORDER_HISTORY_UNAVAILABLE");
  }
}

export interface UserOrderHistoryPage {
  items: UserOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Página server-side do histórico; mantém o mesmo filtro de usuário e tenant do DTO canônico. */
export async function getUserOrderHistoryPage(
  userID: string,
  page = 1,
  pageSize = 10,
  lojaID?: string
): Promise<UserOrderHistoryPage> {
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0 && pageSize <= 50 ? pageSize : 10;
  const where = { userID, ...(lojaID ? { lojaID } : {}) };

  try {
    const total = await prisma.order.count({ where });
    const totalPages = Math.ceil(total / safePageSize);
    const effectivePage = totalPages === 0 ? 1 : Math.min(safePage, totalPages);
    const items = await getUserOrderHistory(
      userID,
      safePageSize,
      (effectivePage - 1) * safePageSize,
      lojaID
    );
    return {
      items,
      total,
      page: effectivePage,
      pageSize: safePageSize,
      totalPages,
    };
  } catch (error) {
    if (error instanceof OrderError) throw error;
    logger.error("Falha ao contar histórico de pedidos", error, {
      action: "ORDER_HISTORY_COUNT_FAILED",
    });
    throw new OrderError("ORDER_HISTORY_UNAVAILABLE");
  }
}
