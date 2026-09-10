import { NextResponse } from 'next/server';
import { z } from 'zod';
import { freightOrchestrator } from '@/services/freight';
import { getLojaFromHeaders } from '@/lib/tenant';
import prisma from '@/lib/prisma';

const calculateFreightSchema = z.object({
  lojaID: z.string().optional(),
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
    .min(1, 'Pelo menos um item é necessário para calcular o frete.'),
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
    const cleanDestCep = destinationCep.replace(/\D/g, '');

    if (cleanDestCep.length !== 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'CEP de destino inválido. Deve conter exatamente 8 dígitos numéricos.',
        },
        { status: 400 }
      );
    }

    // 1. Resolução Multi-Tenant segura: body lojaID -> tenant headers -> produto lojaID
    let resolvedLojaId = lojaID;
    if (!resolvedLojaId) {
      const tenant = await getLojaFromHeaders();
      if (tenant?.id) {
        resolvedLojaId = tenant.id;
      }
    }

    // 2. Enriquecimento seguro: busca dados e dimensões atômicas dos produtos
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        if (item.productId) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: {
              name: true,
              price: true,
              weightInGrams: true,
              lengthCm: true,
              widthCm: true,
              heightCm: true,
              lojaID: true,
            },
          });

          if (product) {
            // Se ainda não resolveu lojaID, resolve pelo produto
            if (!resolvedLojaId && product.lojaID) {
              resolvedLojaId = product.lojaID;
            }

            return {
              ...item,
              name: item.name || product.name,
              price: item.price ?? Number(product.price),
              weightInGrams: item.weightInGrams ?? product.weightInGrams ?? 300,
              lengthCm: item.lengthCm ?? product.lengthCm ?? 16,
              widthCm: item.widthCm ?? product.widthCm ?? 11,
              heightCm: item.heightCm ?? product.heightCm ?? 4,
            };
          }
        }

        // Fallbacks defensivos para itens sem dimensões cadastradas
        return {
          ...item,
          weightInGrams: item.weightInGrams ?? 300,
          lengthCm: item.lengthCm ?? 16,
          widthCm: item.widthCm ?? 11,
          heightCm: item.heightCm ?? 4,
        };
      })
    );

    if (!resolvedLojaId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Identificador da loja não encontrado.',
        },
        { status: 400 }
      );
    }

    const result = await freightOrchestrator.calculate({
      lojaID: resolvedLojaId,
      destinationCep: cleanDestCep,
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
