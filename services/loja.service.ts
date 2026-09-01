import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { tenantCache } from '@/lib/cache'

export interface UpdateLojaSettingsParams {
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
  // Configurações de Frete & Expedição
  originCep?: string | null
  originState?: string | null
  originCity?: string | null
  originDistrict?: string | null
  originStreet?: string | null
  originNumber?: string | null
  originComplement?: string | null
  enableCorreios?: boolean
  correiosContractCode?: string | null
  correiosPassword?: string | null
  enablePickup?: boolean
  enableNoFreight?: boolean
  additionalDays?: number
}

export interface LojaSettings {
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
  // Configurações de Frete & Expedição
  originCep: string | null
  originState: string | null
  originCity: string | null
  originDistrict: string | null
  originStreet: string | null
  originNumber: string | null
  originComplement: string | null
  enableCorreios: boolean
  correiosContractCode: string | null
  correiosPassword: string | null
  enablePickup: boolean
  enableNoFreight: boolean
  additionalDays: number
}

/**
 * Retorna configurações da loja por lojaID com Cache Tenant-Aware (SCL-003)
 */
export async function getLojaSettings(lojaID: string): Promise<LojaSettings | null> {
  return await tenantCache.getOrSet(
    lojaID,
    'settings',
    'config',
    async () => {
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
            originCep: true,
            originState: true,
            originCity: true,
            originDistrict: true,
            originStreet: true,
            originNumber: true,
            originComplement: true,
            enableCorreios: true,
            correiosContractCode: true,
            correiosPassword: true,
            enablePickup: true,
            enableNoFreight: true,
            additionalDays: true,
          },
        })

        return loja
      } catch (error) {
        console.error('[GET_LOJA_SETTINGS]', error)
        return null
      }
    },
    300000 // 5 minutos de cache
  )
}

/**
 * Atualiza configurações da loja e invalida cache do tenant
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
        ...(params.originCep !== undefined && { originCep: params.originCep }),
        ...(params.originState !== undefined && { originState: params.originState }),
        ...(params.originCity !== undefined && { originCity: params.originCity }),
        ...(params.originDistrict !== undefined && { originDistrict: params.originDistrict }),
        ...(params.originStreet !== undefined && { originStreet: params.originStreet }),
        ...(params.originNumber !== undefined && { originNumber: params.originNumber }),
        ...(params.originComplement !== undefined && { originComplement: params.originComplement }),
        ...(params.enableCorreios !== undefined && { enableCorreios: params.enableCorreios }),
        ...(params.correiosContractCode !== undefined && { correiosContractCode: params.correiosContractCode }),
        ...(params.correiosPassword !== undefined && { correiosPassword: params.correiosPassword }),
        ...(params.enablePickup !== undefined && { enablePickup: params.enablePickup }),
        ...(params.enableNoFreight !== undefined && { enableNoFreight: params.enableNoFreight }),
        ...(params.additionalDays !== undefined && { additionalDays: params.additionalDays }),
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
        originCep: true,
        originState: true,
        originCity: true,
        originDistrict: true,
        originStreet: true,
        originNumber: true,
        originComplement: true,
        enableCorreios: true,
        correiosContractCode: true,
        correiosPassword: true,
        enablePickup: true,
        enableNoFreight: true,
        additionalDays: true,
      },
    })

    // Invalida cache da loja específica
    tenantCache.invalidateTenant(lojaID, 'settings')

    try {
      (revalidateTag as any)('tenant-settings')
    } catch {
      // no-op fora de contexto HTTP
    }

    return updated
  } catch (error) {
    console.error('[UPDATE_LOJA_SETTINGS]', error)
    return null
  }
}

/**
 * Consulta pública de loja por slug
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
        originCep: true,
        originState: true,
        originCity: true,
        originDistrict: true,
        originStreet: true,
        originNumber: true,
        originComplement: true,
        enableCorreios: true,
        correiosContractCode: true,
        correiosPassword: true,
        enablePickup: true,
        enableNoFreight: true,
        additionalDays: true,
      },
    })

    return loja
  } catch (error) {
    console.error('[GET_LOJA_BY_SLUG]', error)
    return null
  }
}
