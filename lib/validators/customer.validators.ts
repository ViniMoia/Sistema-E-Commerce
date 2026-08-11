import { z } from 'zod'

export const listCustomersSchema = z.object({
  search: z.string().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export type ListCustomersInput = z.infer<typeof listCustomersSchema>

export const customerIdSchema = z.object({
  customerId: z.string().min(1)
})

export type CustomerIdInput = z.infer<typeof customerIdSchema>