import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { freightOrchestrator } from '@/services/freight'
import { getLojaFromHeaders } from '@/lib/tenant'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { hashFreightItems, signFreightQuote } from '@/lib/freight-quote'
import { logger } from '@/lib/logger'

const calculateFreightSchema = z.object({
  lojaID: z.string().max(100).optional(),
  destinationCep: z.string().min(8).max(9),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(100),
        variantId: z.string().max(100).optional(),
        quantity: z.number().int().positive().max(100).default(1),
      }).strict()
    )
    .min(1, 'Pelo menos um item é necessário para calcular o frete.')
    .max(50, 'O cálculo de frete excede o limite de 50 itens.'),
}).strict()

export async function POST(request: Request) {
  const rateLimitResponse = checkRateLimit(request, 'freight_calculate', 30, 60_000)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const validation = calculateFreightSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros de cálculo inválidos.', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { lojaID, destinationCep, items } = validation.data
    const cleanDestCep = destinationCep.replace(/\D/g, '')
    if (cleanDestCep.length !== 8) {
      return NextResponse.json(
        { success: false, error: 'CEP de destino inválido. Deve conter exatamente 8 dígitos.' },
        { status: 400 }
      )
    }

    const tenant = await getLojaFromHeaders()
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Loja não encontrada.' }, { status: 404 })
    }
    if (lojaID && lojaID !== tenant.id) {
      return NextResponse.json(
        { success: false, error: 'Loja informada não corresponde ao domínio.' },
        { status: 403 }
      )
    }

    const productIds = Array.from(new Set(items.map((item) => item.productId)))
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, lojaID: tenant.id },
      select: {
        id: true,
        name: true,
        price: true,
        weightInGrams: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
      },
    })
    const productMap = new Map(products.map((product) => [product.id, product]))
    if (productMap.size !== productIds.length) {
      return NextResponse.json(
        { success: false, error: 'Um ou mais produtos não pertencem à loja ativa.' },
        { status: 400 }
      )
    }

    const enrichedItems = items.map((item) => {
      const product = productMap.get(item.productId)!
      return {
        ...item,
        name: product.name,
        price: Number(product.price),
        weightInGrams: product.weightInGrams ?? 300,
        lengthCm: product.lengthCm ?? 16,
        widthCm: product.widthCm ?? 11,
        heightCm: product.heightCm ?? 4,
      }
    })

    const result = await freightOrchestrator.calculate({
      lojaID: tenant.id,
      destinationCep: cleanDestCep,
      items: enrichedItems,
    })
    const itemsHash = hashFreightItems(items)
    const signedResult = {
      ...result,
      options: result.options.map((option) => ({
        ...option,
        quoteToken: signFreightQuote({
          lojaID: tenant.id,
          destinationCep: cleanDestCep,
          itemsHash,
          providerId: option.providerId,
          serviceCode: option.serviceCode,
          serviceName: option.serviceName,
          price: new Prisma.Decimal(option.price).toDecimalPlaces(2).toFixed(2),
          deliveryTimeInDays: option.deliveryTimeInDays,
        }),
      })),
    }

    return NextResponse.json({ success: true, data: signedResult }, { status: 200 })
  } catch (error: any) {
    logger.error('Falha ao calcular frete', error, { action: 'FREIGHT_CALCULATE_API_ERROR' })
    return NextResponse.json(
      { success: false, error: 'Erro interno ao calcular opções de frete.' },
      { status: 500 }
    )
  }
}
