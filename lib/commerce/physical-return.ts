import { z } from 'zod';

export const physicalReturnSchema = z.object({
  commandId: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/),
  expectedVersion: z.number().int().nonnegative(),
  inspectionReference: z.string().trim().min(3).max(200),
  receivedAllItems: z.literal(true),
  items: z.array(z.object({
    orderItemId: z.string().min(1).max(128),
    receivedQuantity: z.number().int().positive().max(2147483647),
    restockQuantity: z.number().int().nonnegative().max(2147483647),
  }).strict()).min(1).max(200),
}).strict();

export type PhysicalReturnCommand = z.infer<typeof physicalReturnSchema>;
export const physicalReturnKey = (orderId: string) => `physical-return:${orderId}`;
export const PHYSICAL_RETURN_ACTION = 'ORDER_PHYSICAL_RETURN_COMPLETED';

export const physicalReturnViewSchema = z.object({
  orderId: z.string(), version: z.number().int(), eligible: z.boolean(), completed: z.boolean(),
  items: z.array(z.object({ id: z.string(), name: z.string(), size: z.string().nullable(), color: z.string().nullable(), quantity: z.number().int().positive() })),
  receipt: z.object({ at: z.string(), result: z.object({
    orderVersion: z.number().int(), status: z.string(),
    movements: z.array(z.object({ orderItemId: z.string(), received: z.number().int(), available: z.number().int(), unavailable: z.number().int() })),
  }) }).nullable(),
});
export type PhysicalReturnView = z.infer<typeof physicalReturnViewSchema>;
