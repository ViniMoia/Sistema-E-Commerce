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

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(150, 'Nome não pode exceder 150 caracteres'),
  phone: z
    .string()
    .trim()
    .max(20, 'Telefone não pode exceder 20 caracteres')
    .optional()
    .nullable()
    .transform((val) => (!val || val.trim() === '' ? null : val.trim())),
  cpfCnpj: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (!val || val.trim() === '' ? null : val.trim())),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>