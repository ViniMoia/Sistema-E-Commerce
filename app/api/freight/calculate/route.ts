import { NextResponse } from 'next/server';
import { z } from 'zod';
import { freightOrchestrator } from '@/services/freight';
import prisma from '@/lib/prisma';

const calculateFreightSchema = z.object({
  lojaID: z.string().min(1, 'lojaID é obrigatório'),
  destinationCep: z.string().min(8, 'CEP de destino inválido'),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        variantId: z.string().optional(),
        name: z.string().optional(),
        quantity: z.number().int().positive().default(1),
        price: z.number().optional(),
        weightInGrams: z.number().nullable().optional(),
        lengthCm: z.number().nullable().optional(),
        widthCm: z.number().nullable().optional(),
        heightCm: z.number().nullable().optional(),
      })
    )
    .default([]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = calculateFreightSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parâmetros de cálculo inválidos.',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { lojaID, destinationCep, items } = validation.data;

    // Enriquecimento seguro: se os itens vierem apenas com productId, busca dimensões no banco
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        if (item.productId && (item.weightInGrams === undefined || item.weightInGrams === null)) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: {
              name: true,
              price: true,
              weightInGrams: true,
              lengthCm: true,
              widthCm: true,
              heightCm: true,
            },
          });

          if (product) {
            return {
              ...item,
              name: item.name || product.name,
              price: item.price ?? Number(product.price),
              weightInGrams: product.weightInGrams,
              lengthCm: product.lengthCm,
              widthCm: product.widthCm,
              heightCm: product.heightCm,
            };
          }
        }
        return item;
      })
    );

    const result = await freightOrchestrator.calculate({
      lojaID,
      destinationCep,
      items: enrichedItems,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[FREIGHT_CALCULATE_API_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao calcular opções de frete.',
      },
      { status: 500 }
    );
  }
}
