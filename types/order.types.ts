import { Prisma } from "@prisma/client";

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  userID: string;
  cartID: string;
  addressID: string;
  lojaID: string;
}

export interface GetUserOrdersParams {
  userID: string;
  lojaID: string;
  limit?: number;
  skip?: number;
}

export interface OrderItemSummary {
  name: string;
  price: number;
  quantity: number;
  color?: string | null;
  size?: string | null;
  imageUrl?: string | null;
}

export interface UserOrder {
  id: string;
  orderNumber: number;
  status: string;
  total: number;
  createdAt: Date;
  trackingCode?: string | null;
  deliveryType?: 'DELIVERY' | 'PICKUP' | 'NONE' | null;
  shippingServiceName?: string | null;
  deliveredConfirmedAt?: Date | string | null;
  items: OrderItemSummary[];
}

// ─── Return Types (derivados do Prisma para garantir sincronia com o schema) ──

/**
 * Tipo completo de um Order retornado por getOrderById.
 * Usa Prisma.OrderGetPayload para derivar automaticamente do schema,
 * evitando divergências entre tipo e query.
 */
export type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: true;
        variant: true;
      };
    };
    address: true;
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        phone: true;
        avatarImageUrl: true;
        role: true;
        status: true;
      };
    };
  };
}>;

/**
 * Tipo resumido para listagem de pedidos do usuário.
 */
export type OrderSummary = Prisma.OrderGetPayload<{
  include: {
    items: true;
  };
}>;
