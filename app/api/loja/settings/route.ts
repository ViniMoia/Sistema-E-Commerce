import { createRequestLogContext, runWithLogContext, attachRequestId } from '@/lib/observability/request-context'
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getLojaSettings, updateLojaSettings } from "@/services/loja.service";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { TENANT_SETTINGS_CACHE_TAG } from "@/lib/cache-tags";
import { logger } from "@/lib/logger";

const updateLojaSettingsSchema = z.object({
  pixKey: z.string().nullable().optional(),
  pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA']).nullable().optional(),
  whatsappNumber: z.string().nullable().optional(),
  name: z.string().min(2, "Nome da loja deve ter pelo menos 2 caracteres").optional(),
  slug: z.string().min(2, "Slug da loja deve ter pelo menos 2 caracteres").optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().url("URL da logomarca/capa inválida").optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor primária inválida (deve ser hex #RRGGBB)").optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor secundária inválida (deve ser hex #RRGGBB)").optional(),
  customDomain: z.string().nullable().optional(),
  // Configurações de Frete & Expedição
  originCep: z.string().nullable().optional(),
  originState: z.string().nullable().optional(),
  originCity: z.string().nullable().optional(),
  originDistrict: z.string().nullable().optional(),
  originStreet: z.string().nullable().optional(),
  originNumber: z.string().nullable().optional(),
  originComplement: z.string().nullable().optional(),
  enableCorreios: z.boolean().optional(),
  correiosContractCode: z.string().nullable().optional(),
  enablePickup: z.boolean().optional(),
  enableNoFreight: z.boolean().optional(),
  additionalDays: z.number().int().nonnegative().optional(),
});

/**
 * GET /api/loja/settings
 */
export async function GET(request: Request) {
  try {
    const guard = await requireAdmin(request);
    if (guard instanceof NextResponse) return guard;

    const lojaID = guard.user.lojaID;
    if (!lojaID) {
      return NextResponse.json(
        { error: "User not associated with any loja" },
        { status: 400 }
      );
    }

    const settings = await getLojaSettings(lojaID);
    if (!settings) {
      return NextResponse.json(
        { error: "Loja settings not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    logger.error('Falha nas configuracoes da loja', error, { action: 'LOJA_SETTINGS_GET' });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/loja/settings
 */
export async function PUT(request: Request) {
  const context = createRequestLogContext(request.headers)
  return runWithLogContext(context, async () => attachRequestId(await handleSettingsUpdate(request), context.requestId))
}

async function handleSettingsUpdate(request: Request) {
  try {
    const guard = await requireAdmin(request);
    if (guard instanceof NextResponse) return guard;

    const lojaID = guard.user.lojaID;
    if (!lojaID) {
      return NextResponse.json(
        { error: "User not associated with any loja" },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const parsed = updateLojaSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const updated = await updateLojaSettings(lojaID, parsed.data, guard.user.id);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update loja settings" },
        { status: 500 }
      );
    }

    // Next.js pertence à borda HTTP. Falha de invalidação não desfaz a
    // atualização persistida; o cache local do tenant já foi invalidado.
    try {
      revalidateTag(TENANT_SETTINGS_CACHE_TAG, 'max');
    } catch (error) {
      logger.error('Falha nas configuracoes da loja', error, { action: 'LOJA_SETTINGS_REVALIDATE' });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    logger.error('Falha nas configuracoes da loja', error, { action: 'LOJA_SETTINGS_PUT' });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
