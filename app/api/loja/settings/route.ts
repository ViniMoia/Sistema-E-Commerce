import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getLojaSettings, updateLojaSettings } from "@/lib/services/loja.service";
import { z } from "zod";

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
});

/**
 * GET /api/loja/settings
 * Get current loja settings (admin only)
 */
export async function GET(request: Request) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    // In a real multi-tenant app, we'd get lojaID from user's lojaID
    // For now, we'll assume the admin manages their own loja
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
    console.error("[LOJA_SETTINGS_GET]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/loja/settings
 * Update loja settings (admin only)
 */
export async function PUT(request: Request) {
  try {
    const guard = await requireAdmin();
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

    const updated = await updateLojaSettings(lojaID, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update loja settings" },
        { status: 500 }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("[LOJA_SETTINGS_PUT]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}