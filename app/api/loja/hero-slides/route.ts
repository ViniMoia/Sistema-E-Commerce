import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getLojaSettings, updateLojaHeroSlides } from "@/services/loja.service";
import { heroSlidesArraySchema } from "@/lib/validators/hero-slides";

export async function GET(request: Request) {
  try {
    const guard = await requireAdmin(request);
    if (guard instanceof NextResponse) return guard;

    const lojaID = guard.user.lojaID;
    if (!lojaID) {
      return NextResponse.json(
        { error: "Usuário não associado a nenhuma loja" },
        { status: 400 }
      );
    }

    const settings = await getLojaSettings(lojaID);
    if (!settings) {
      return NextResponse.json(
        { error: "Loja não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { heroSlides: Array.isArray(settings.heroSlides) ? settings.heroSlides : [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[LOJA_HERO_SLIDES_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const guard = await requireAdmin(request);
    if (guard instanceof NextResponse) return guard;

    const lojaID = guard.user.lojaID;
    if (!lojaID) {
      return NextResponse.json(
        { error: "Usuário não associado a nenhuma loja" },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const rawSlides =
      body && typeof body === "object" && "heroSlides" in body
        ? (body as { heroSlides: unknown }).heroSlides
        : body;

    const parsed = heroSlidesArraySchema.safeParse(rawSlides);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const updated = await updateLojaHeroSlides(lojaID, parsed.data, guard.user.id);
    if (!updated) {
      return NextResponse.json(
        { error: "Falha ao atualizar painéis da Hero" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { heroSlides: updated.heroSlides ?? [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[LOJA_HERO_SLIDES_PUT]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
