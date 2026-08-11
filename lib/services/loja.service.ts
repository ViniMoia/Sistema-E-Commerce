import { Prisma, PrismaClient } from '@prisma/client'
import prisma from '@/lib/prisma'

interface UpdateLojaSettingsParams {
  pixKey?: string | null
  pixKeyType?: string | null
  whatsappNumber?: string | null
  name?: string
  slug?: string
  description?: string
  coverImageUrl?: string
  primaryColor?: string | null
  secondaryColor?: string | null
  customDomain?: string | null
}

interface LojaSettings {
  id: string
  name: string
  slug: string
  description: string
  coverImageUrl: string
  pixKey: string | null
  pixKeyType: string | null
  whatsappNumber: string | null
  primaryColor: string | null
  secondaryColor: string | null
  customDomain: string | null
}

/**
 * Get loja settings by lojaID
 */
export async function getLojaSettings(lojaID: string): Promise<LojaSettings | null> {
  try {
    const loja = await prisma.loja.findUnique({
      where: { id: lojaID },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        coverImageUrl: true,
        pixKey: true,
        pixKeyType: true,
        whatsappNumber: true,
        primaryColor: true,
        secondaryColor: true,
        customDomain: true,
      },
    })

    return loja as any
  } catch (error) {
    console.error('[GET_LOJA_SETTINGS]', error)
    return null
  }
}

import { revalidateTag } from "next/cache"

/**
 * Update loja settings (pixKey, whatsappNumber, etc.)
 */
export async function updateLojaSettings(
  lojaID: string,
  params: UpdateLojaSettingsParams
): Promise<LojaSettings | null> {
  try {
    const updated = await prisma.loja.update({
      where: { id: lojaID },
      data: {
        ...(params.pixKey !== undefined && { pixKey: params.pixKey }),
        ...(params.pixKeyType !== undefined && { pixKeyType: params.pixKeyType }),
        ...(params.whatsappNumber !== undefined && { whatsappNumber: params.whatsappNumber }),
        ...(params.name !== undefined && { name: params.name }),
        ...(params.slug !== undefined && { slug: params.slug }),
        ...(params.description !== undefined && { description: params.description }),
        ...(params.coverImageUrl !== undefined && { coverImageUrl: params.coverImageUrl }),
        ...(params.primaryColor !== undefined && { primaryColor: params.primaryColor }),
        ...(params.secondaryColor !== undefined && { secondaryColor: params.secondaryColor }),
        ...(params.customDomain !== undefined && { customDomain: params.customDomain }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        coverImageUrl: true,
        pixKey: true,
        pixKeyType: true,
        whatsappNumber: true,
        primaryColor: true,
        secondaryColor: true,
        customDomain: true,
      },
    })

    // Invalida o cache de configurações da loja para que a alteração seja imediata
    revalidateTag("tenant-settings")

    return updated as any
  } catch (error) {
    console.error('[UPDATE_LOJA_SETTINGS]', error)
    return null
  }
}

/**
 * Get loja info by slug (public endpoint)
 */
export async function getLojaBySlug(slug: string): Promise<LojaSettings | null> {
  try {
    const loja = await prisma.loja.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        coverImageUrl: true,
        pixKey: true,
        pixKeyType: true,
        whatsappNumber: true,
        primaryColor: true,
        secondaryColor: true,
        customDomain: true,
      },
    })

    return loja as any
  } catch (error) {
    console.error('[GET_LOJA_BY_SLUG]', error)
    return null
  }
}