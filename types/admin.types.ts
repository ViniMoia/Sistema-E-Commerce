import type { OrderStatus } from "@prisma/client";
import type { CommerceActor } from '@/lib/commerce/contracts';

export type ListOrdersParams = {
  pageSize?: number;
  status?: OrderStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  cursor?: string;
  lojaID?: string;
  customerId?: string;
};



export type UpdateOrderStatusInput = {
  orderId: string;
  newStatus: OrderStatus;
  performedById: string;
  ipAddress?: string;
  reason?: string;
  paidAt?: Date | string;
  actor?: CommerceActor;
  commandId?: string;
  expectedVersion?: number;
  confirmReceipt?: boolean;
  trackingCode?: string | null;
  /** Optional assertion against the persisted freight provider, never an override. */
  shippingProvider?: string | null;
};

export type UpdateStatusResult =
  | { success: true; order: { id: string; status: OrderStatus; version?: number; orderNumber?: number; deliveredConfirmedAt?: Date | null; trackingCode?: string | null; shippingProvider?: string | null } }
  | { success: false; error: string; code: "NOT_FOUND" | "INVALID_TRANSITION" | 'FORBIDDEN' | 'CONFLICT' | 'INVALID_INPUT' };

export type ListCustomersParams = {
  pageSize?: number;
  search?: string;
  cursor?: string;
  lojaID?: string;
};

export type CustomerMetrics = {
  totalOrders: number;
  totalSpent: number;
  averageTicket: number;
  lastOrderDate: Date | null;
};
