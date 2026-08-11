import { ok, err } from '@/lib/api-response'
import { createOrder } from '@/lib/services/checkout.service'
import { createOrderSchema, type CreateOrderInput } from '@/lib/validators/checkout.validators'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function POST(request: Request) {
  const body = await request.json()
  const parseResult = createOrderSchema.safeParse(body)
  if (!parseResult.success) {
    return err('Dados de checkout inválidos.', 400)
  }
  const data = parseResult.data as CreateOrderInput

  if (data.deliveryType === 'DELIVERY' && !data.address) {
    return err('Endereço obrigatório para entrega.', 400)
  }

  let freightValue = data.freightValue
  if (data.deliveryType === 'DELIVERY' && freightValue === undefined) {
    const rule = await prisma.freightRule.findFirst({
      where: { lojaID: data.lojaID, cityName: data.address!.city },
    })
    freightValue = rule ? (rule.value as Prisma.Decimal).toNumber() : 0
  }

  try {
    const result = await createOrder({ ...data, freightValue })
    return ok(result)
  } catch (error: any) {
    console.error("[CHECKOUT_ERROR]", error)
    return err(error?.message || "Erro interno do servidor ao criar pedido", 500)
  }
}
