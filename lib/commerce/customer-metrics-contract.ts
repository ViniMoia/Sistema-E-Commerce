import { z } from 'zod';

export const CUSTOMER_FINANCIAL_POLICY = 'LIFETIME_RECOGNIZED_NET_V1' as const;
export const CUSTOMER_METRICS_TIMEZONE = 'America/Sao_Paulo';
const money = z.number().finite().nonnegative().refine(value => Number.isSafeInteger(Math.round(value * 100)));
const count = z.number().int().nonnegative();
const date = z.string().datetime().nullable();
export const customerFinancialSummarySchema = z.object({
  policy: z.literal(CUSTOMER_FINANCIAL_POLICY), currency: z.literal('BRL'),
  coverage: z.enum(['COMPLETE', 'PARTIAL']), asOf: z.string().datetime(),
  totalOrders: count, recognizedOrderCount: count, unverifiedOrders: count, financialReviewOrders: count,
  totalOrderValue: money, totalMerchandiseOrdered: money, recognizedGross: money,
  settledGross: money, confirmedRefunds: money, totalSpent: money, averageOrderValue: money,
  firstOrderAt: date, lastOrderAt: date, cancelledOrders: count,
});
export const customerMetricsSchema = customerFinancialSummarySchema.extend({
  mostBoughtProduct: z.string().nullable(), preferredDeliveryType: z.enum(['DELIVERY', 'PICKUP', 'NONE']).nullable(),
});
export const customerRowSchema = customerFinancialSummarySchema.extend({
  id: z.string().min(1), name: z.string(), email: z.string(), phone: z.string().nullable(),
  cpfCnpj: z.string().nullable(), createdAt: z.string().datetime(),
});
export const customerListSchema = z.object({ data: z.array(customerRowSchema), nextCursor: z.string().nullable() });
export type CustomerFinancialSummary = Required<z.infer<typeof customerFinancialSummarySchema>>;
