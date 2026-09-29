import { createRequestLogContext, runWithLogContext, attachRequestId } from '@/lib/observability/request-context'
import { NextResponse } from 'next/server'
import { persistAuditedSettings } from '@/services/store-settings-audit.service'
import { ok, err } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth/guards'
import { getLoyaltySettings, UpdateLoyaltyConfigSchema } from '@/services/loyalty.service'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const settings = await getLoyaltySettings(auth.user.lojaID)
    return ok(settings)
  } catch (error: any) {
    logger.error('Falha ao carregar configuraÃ§Ã£o de fidelidade', error, { action: 'ADMIN_LOYALTY_CONFIG_GET_ERROR' })
    return err('Erro interno ao carregar configurações de fidelidade.', 500, 'LOYALTY_CONFIG_INTERNAL_ERROR')
  }
}

export async function PUT(req: Request) {
  const context = createRequestLogContext(req.headers)
  return runWithLogContext(context, async () => attachRequestId(await handleSettingsUpdate(req), context.requestId))
}

async function handleSettingsUpdate(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido.', 400)
  }

  const parseResult = UpdateLoyaltyConfigSchema.safeParse(body)
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    return err(issue ? issue.message : 'Configurações de fidelidade inválidas.', 400)
  }

  const data = parseResult.data

  try {
    const updatedLoja = await persistAuditedSettings(auth.user.lojaID, auth.user.id,
      'LOYALTY_SETTINGS_UPDATE', Object.keys(data), tx => tx.loja.update({
      where: { id: auth.user.lojaID },
      data: {
        loyaltyEnabled: data.loyaltyEnabled,
        loyaltyEarnRate: new Prisma.Decimal(data.loyaltyEarnRate),
        loyaltyPointValue: new Prisma.Decimal(data.loyaltyPointValue),
        loyaltyMinPointsRedeem: data.loyaltyMinPointsRedeem,
        loyaltyMaxDiscountPct: new Prisma.Decimal(data.loyaltyMaxDiscountPct),
        loyaltyPointsExpiryDays: data.loyaltyPointsExpiryDays ?? null,
      },
      select: {
        loyaltyEnabled: true,
        loyaltyEarnRate: true,
        loyaltyPointValue: true,
        loyaltyMinPointsRedeem: true,
        loyaltyMaxDiscountPct: true,
        loyaltyPointsExpiryDays: true,
      },
    }))

    return ok({
      loyaltyEnabled: updatedLoja.loyaltyEnabled,
      loyaltyEarnRate: Number(updatedLoja.loyaltyEarnRate.toString()),
      loyaltyPointValue: Number(updatedLoja.loyaltyPointValue.toString()),
      loyaltyMinPointsRedeem: updatedLoja.loyaltyMinPointsRedeem,
      loyaltyMaxDiscountPct: Number(updatedLoja.loyaltyMaxDiscountPct.toString()),
      loyaltyPointsExpiryDays: updatedLoja.loyaltyPointsExpiryDays,
    })
  } catch (error: any) {
    logger.error('Falha ao atualizar configuraÃ§Ã£o de fidelidade', error, { action: 'ADMIN_LOYALTY_CONFIG_PUT_ERROR' })
    return err('Erro interno ao atualizar configurações de fidelidade.', 500, 'LOYALTY_CONFIG_INTERNAL_ERROR')
  }
}
