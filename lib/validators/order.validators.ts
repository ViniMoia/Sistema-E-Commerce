import { z } from 'zod';

const STATUS = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

export const listOrdersQuerySchema = z.object({
  status: z.enum(STATUS).optional(),
  search: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  cursor: z.string().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  customerId: z.string().optional(),
});

export const updateOrderStatusBodySchema = z.object({
  newStatus: z.enum(STATUS),
  commandId: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/).optional(),
  expectedVersion: z.number().int().min(0).optional(),
  trackingCode: z.string().trim().max(128).nullable().optional(),
  shippingProvider: z.string().trim().max(64).nullable().optional(),
});

export const updateOrderTrackingBodySchema = updateOrderStatusBodySchema.omit({ newStatus: true }).extend({
  trackingCode: z.string().trim().max(128).nullable(),
  commandId: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/),
  expectedVersion: z.number().int().min(0),
});

export const orderOperationDetailSchema = z.object({
  id: z.string().min(1), version: z.number().int().min(0), status: z.enum(STATUS),
  deliveryType: z.enum(['DELIVERY', 'PICKUP', 'NONE']), trackingCode: z.string().nullable(), shippingProvider: z.string().nullable(),
  actions: z.object({ statuses: z.array(z.enum(STATUS)), tracking: z.object({
    provider: z.string().nullable(), applicable: z.boolean(), required: z.boolean(),
    format: z.enum(['CORREIOS', 'GENERIC']), editable: z.boolean(),
  }) }),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusBodySchema>;
