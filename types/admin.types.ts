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
  reason?: string;
  paidAt?: Date | string;
  trackingCode?: string | null;
  expectedUserID?: string;
  deliveredConfirmedById?: string;
  /** Somente adaptadores financeiros autenticados podem confirmar que o estorno ocorreu. */
  paymentRefundConfirmed?: boolean;
};

export type UpdateStatusResult =
  | {
      success: true;
      order: {
        id: string;
        status: OrderStatus;
        deliveredConfirmedAt?: Date | null;
      };
    }
  | {
      success: false;
      error: string;
      code:
        | "NOT_FOUND"
        | "INVALID_TRANSITION"
        | "CONFLICT"
        | "REFUND_REQUIRED"
        | "FINANCIAL_REVIEW_REQUIRED";
    };

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
