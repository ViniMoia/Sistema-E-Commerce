import prisma from '@/lib/prisma'
import { tenantCache } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { persistAuditedSettings } from '@/services/store-settings-audit.service'

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
            enablePickup: true,
            enableNoFreight: true,
            additionalDays: true,
          },
        })

        return loja
      } catch (error) {
        logger.error('Falha ao consultar configurações', error, { action: 'GET_LOJA_SETTINGS' })
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
  params: UpdateLojaSettingsParams,
  actorId: string,
): Promise<LojaSettings | null> {
  try {
    const updated = await persistAuditedSettings(lojaID, actorId, 'STORE_SETTINGS_UPDATE', Object.keys(params), tx => tx.loja.update({
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
        enablePickup: true,
        enableNoFreight: true,
        additionalDays: true,
      },
    }))

    // Invalida cache da loja específica
    tenantCache.invalidateTenant(lojaID, 'settings')

    return updated
  } catch (error) {
    logger.error('Falha ao atualizar configurações', error, { action: 'UPDATE_LOJA_SETTINGS' })
    return null
  }
}

/**
 * Consulta pública de loja por slug
 */
export interface PublicLoja {
  id: string
  name: string
  slug: string
  description: string
  coverImageUrl: string
  whatsappNumber: string | null
  primaryColor: string | null
  secondaryColor: string | null
}

export async function getLojaBySlug(slug: string): Promise<PublicLoja | null> {
  try {
    const loja = await prisma.loja.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        coverImageUrl: true,
        whatsappNumber: true,
        primaryColor: true,
        secondaryColor: true,
      },
    })

    return loja
  } catch (error) {
    logger.error('[GET_LOJA_BY_SLUG]', error);
    return null
  }
}
