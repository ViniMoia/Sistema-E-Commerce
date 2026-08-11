import { z } from 'zod'

const cartItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  color: z.string().optional(),
  size: z.string().optional(),
})

const customerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  userId: z.string().optional(),
})

const addressSchema = z.object({
  state: z.string().min(2),
  city: z.string().min(2),
  neighborhood: z.string().min(2),
  street: z.string().min(2),
  number: z.string().min(1),
  complement: z.string().optional(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
})

export const createOrderSchema = z.object({
  lojaID: z.string().min(1),
  customer: customerSchema,
  items: z.array(cartItemSchema).min(1),
  address: addressSchema.optional(),
  deliveryType: z.enum(['DELIVERY', 'PICKUP']),
  freightValue: z.number().nonnegative().optional(),
  pixKey: z.string().optional(),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
