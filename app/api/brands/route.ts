import { NextResponse } from "next/server";
import { getLojaFromHeaders } from "@/lib/tenant";
import * as brandService from "@/services/brand.service";

export async function GET() {
  try {
    const activeLoja = await getLojaFromHeaders();
    if (!activeLoja) {
      return NextResponse.json(
        { error: "Loja não encontrada para este domínio" },
        { status: 404 }
      );
    }

    const brands = await brandService.getBrandsWithProductCount({
      lojaId: activeLoja.id,
    });

    return NextResponse.json(brands, { status: 200 });
  } catch (error) {
    console.error("[BRANDS_GET]", error);
    return NextResponse.json(
      { error: "Erro interno ao consultar marcas" },
      { status: 500 }
    );
  }
}
