import { z } from 'zod';

const identity = z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/);
export const cartMutationSchema = z.object({
  commandId: identity,
  cartId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),
  expectedVersion: z.number().int().min(0).optional(),
}).strict();
export type CartMutation = z.infer<typeof cartMutationSchema>;
export const cartAbsoluteMutationSchema = cartMutationSchema.extend({
  cartId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  expectedVersion: z.number().int().min(0),
});
