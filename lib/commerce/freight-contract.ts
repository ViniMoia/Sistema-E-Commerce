import { z } from 'zod';
export const freightClientItemsSchema = z.array(z.object({ productId: z.string().min(1).max(128), variantId: z.string().min(1).max(128).optional(),
  quantity: z.number().int().min(1).max(99) })).min(1).max(100);
export const freightClientRequestSchema = z.object({ lojaID: z.string().min(1), destinationCep: z.string().regex(/^\d{8}$/),
  deliveryType: z.literal('DELIVERY'), items: freightClientItemsSchema });
export const freightClientResponseSchema = z.object({ success: z.literal(true), data: z.object({
  serverTime: z.string().datetime({ offset: true }),
  merchandiseSubtotal: z.string().regex(/^\d+\.\d{2}$/),
  options: z.array(z.object({ providerId: z.string().min(1), serviceCode: z.string().min(1), serviceName: z.string().min(1),
    price: z.number().finite().nonnegative(), deliveryTimeInDays: z.number().int().nonnegative(),
    freightQuoteToken: z.string().min(1), freightQuoteId: z.string().min(1), expiresAt: z.string().datetime({ offset: true }),
    description: z.string().optional(), isRecommended: z.boolean().optional() })) }) });
export type FreightClientRequest = z.infer<typeof freightClientRequestSchema>;
export type FreightClientResponse = z.infer<typeof freightClientResponseSchema>;
