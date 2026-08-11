import type { OrderStatus } from "@prisma/client";

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
};

export type UpdateStatusResult =
  | { success: true; order: { id: string; status: OrderStatus } }
  | { success: false; error: string; code: "NOT_FOUND" | "INVALID_TRANSITION" };

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
