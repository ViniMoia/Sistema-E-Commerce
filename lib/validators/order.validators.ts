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
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusBodySchema>;
