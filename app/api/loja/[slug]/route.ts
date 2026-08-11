import { NextResponse } from "next/server";
import { getLojaBySlug } from "@/lib/services/loja.service";

/**
 * GET /api/loja/[slug]
 * Public endpoint to get loja info by slug (for checkout page)
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    if (!slug) {
      return NextResponse.json(
        { error: "Loja slug is required" },
        { status: 400 }
      );
    }

    const loja = await getLojaBySlug(slug);

    if (!loja) {
      return NextResponse.json(
        { error: "Loja not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(loja, { status: 200 });
  } catch (error) {
    console.error("[LOJA_GET_BY_SLUG]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}