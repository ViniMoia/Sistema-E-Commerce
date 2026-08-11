import { NextResponse } from "next/server";
import { getLojaFromHeaders } from "@/lib/tenant";

export async function GET() {
  try {
    const loja = await getLojaFromHeaders();
    if (!loja) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }
    return NextResponse.json({
      id: loja.id,
      name: loja.name,
      slug: loja.slug,
      description: loja.description,
      coverImageUrl: loja.coverImageUrl,
      whatsappNumber: loja.whatsappNumber,
    });
  } catch (error) {
    console.error("[LOJA_ACTIVE_GET]", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
