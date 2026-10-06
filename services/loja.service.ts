import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { tenantCache } from '@/lib/cache'
import { adminLojaSelect, publicLojaSelect, toAdminLojaDTO, toPublicLojaDTO, type AdminLojaDTO, type PublicLojaDTO } from '@/lib/loja-dto'

export interface UpdateLojaSettingsParams {
  enableManualPix?: boolean
  enablePix?: boolean
  enableCreditCard?: boolean
  enableBoleto?: boolean
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

export type LojaSettings = AdminLojaDTO

/**
 * Read administrative settings from persistence on every request. A local TTL
 * cannot observe updates committed by another application instance.
 */
export async function getLojaSettings(lojaID: string): Promise<LojaSettings | null> {
  try {
    const loja = await prisma.loja.findUnique({
      where: { id: lojaID },
      select: adminLojaSelect,
    })
    return loja ? toAdminLojaDTO(loja) : null
  } catch {
    console.error('[GET_LOJA_SETTINGS]', 'Falha ao acessar configurações da loja')
    return null
  }
}

/**
 * Atualiza configurações da loja e invalida cache do tenant
 */
export async function updateLojaSettings(
  lojaID: string,
  params: UpdateLojaSettingsParams,
  actorId?: string
): Promise<LojaSettings | null> {
  try {
    const changesPayment = ['enableManualPix', 'enablePix', 'enableCreditCard', 'enableBoleto'].some(key => key in params);
    if (changesPayment && !actorId) throw new Error('PAYMENT_POLICY_ACTOR_REQUIRED');
    const write = (client: Pick<typeof prisma, 'loja'>) => client.loja.update({
      where: { id: lojaID },
      data: {
        ...(params.enableManualPix !== undefined && { enableManualPix: params.enableManualPix }),
        ...(params.enablePix !== undefined && { enablePix: params.enablePix }),
        ...(params.enableCreditCard !== undefined && { enableCreditCard: params.enableCreditCard }),
        ...(params.enableBoleto !== undefined && { enableBoleto: params.enableBoleto }),
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
      select: adminLojaSelect,
    })

    const updated = actorId ? await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Loja" WHERE id = ${lojaID} FOR UPDATE`;
      const actor = await tx.user.findUnique({ where: { id: actorId } });
      if (!actor || actor.lojaID !== lojaID || actor.status !== 'ACTIVE' || actor.role !== 'ADMIN') throw new Error('PAYMENT_POLICY_ACTOR_FORBIDDEN');
      return write(tx);
    }) : await write(prisma);

    // Invalida cache da loja específica
    tenantCache.invalidateTenant(lojaID, 'settings')

    try {
      revalidateTag('tenant-settings', { expire: 0 })
    } catch {
      // no-op fora de contexto HTTP
    }

    return toAdminLojaDTO(updated)
  } catch {
    console.error('[UPDATE_LOJA_SETTINGS]', 'Falha ao acessar configurações da loja')
    return null
  }
}

/**
 * Consulta pública de loja por slug
 */
export async function getLojaBySlug(slug: string): Promise<PublicLojaDTO | null> {
  try {
    const loja = await prisma.loja.findUnique({
      where: { slug },
      select: publicLojaSelect,
    })

    return loja ? toPublicLojaDTO(loja) : null
  } catch {
    console.error('[GET_LOJA_BY_SLUG]', 'Falha ao acessar configurações da loja')
    return null
  }
}
