import type { Prisma } from '@prisma/client'

export const publicLojaSelect = {
  id: true, name: true, slug: true, description: true, coverImageUrl: true,
  pixKey: true, pixKeyType: true, whatsappNumber: true,
  primaryColor: true, secondaryColor: true, customDomain: true,
  enableCorreios: true, enablePickup: true, enableNoFreight: true, additionalDays: true,
  enableManualPix: true, enablePix: true, enableCreditCard: true, enableBoleto: true,
} as const satisfies Prisma.LojaSelect

export const adminLojaSelect = {
  ...publicLojaSelect,
  originCep: true, originState: true, originCity: true, originDistrict: true,
  originStreet: true, originNumber: true, originComplement: true,
  correiosContractCode: true, correiosPassword: true,
} as const satisfies Prisma.LojaSelect

export type PublicLojaDTO = Prisma.LojaGetPayload<{ select: typeof publicLojaSelect }>
type AdminSource = Prisma.LojaGetPayload<{ select: typeof adminLojaSelect }>
export type AdminLojaDTO = Omit<AdminSource, 'correiosContractCode' | 'correiosPassword'> & {
  hasCorreiosContractCode: boolean
  hasCorreiosPassword: boolean
}

// A fresh whitelist object protects serialization even if a repository returns
// additional columns. Neither stored credentials nor masked placeholders travel.
export function toPublicLojaDTO(source: PublicLojaDTO): PublicLojaDTO {
  return Object.fromEntries(Object.keys(publicLojaSelect).map(key => [key, source[key as keyof PublicLojaDTO]])) as PublicLojaDTO
}

export function toAdminLojaDTO(source: AdminSource | AdminLojaDTO): AdminLojaDTO {
  return {
    ...toPublicLojaDTO(source),
    originCep: source.originCep, originState: source.originState, originCity: source.originCity,
    originDistrict: source.originDistrict, originStreet: source.originStreet,
    originNumber: source.originNumber, originComplement: source.originComplement,
    hasCorreiosContractCode: Boolean('correiosContractCode' in source ? source.correiosContractCode : source.hasCorreiosContractCode),
    hasCorreiosPassword: Boolean('correiosPassword' in source ? source.correiosPassword : source.hasCorreiosPassword),
  }
}

/** Empty replacement preserves storage; null is an explicit removal command. */
export function correiosCredentialChanges(contractCode: string, password: string, remove: boolean) {
  if (remove) return { correiosContractCode: null, correiosPassword: null }
  return {
    ...(contractCode.trim() && { correiosContractCode: contractCode.trim() }),
    ...(password && { correiosPassword: password }),
  }
}
