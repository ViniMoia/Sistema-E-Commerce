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
  trackingCode: z.string().trim().min(1).max(100).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.trackingCode != null && value.newStatus !== 'SHIPPED') {
    context.addIssue({
      code: 'custom',
      path: ['trackingCode'],
      message: 'O código de rastreio só pode ser informado ao despachar o pedido.',
    });
  }
});

export const requestRefundBodySchema = z.object({
  amount: z.number().positive().finite().refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
    'O valor deve ter no maximo duas casas decimais.'
  ).optional(),
  reason: z.string().trim().min(3).max(500),
}).strict();

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusBodySchema>;
export type RequestRefundBody = z.infer<typeof requestRefundBodySchema>;
