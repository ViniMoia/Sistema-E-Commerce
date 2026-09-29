import { logger } from '@/lib/logger'
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import * as productService from "@/services/product.service";
import { productFiltersSchema, createProductSchema } from "@/lib/validators/product";
import { getLojaFromHeaders } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams.entries());

    const parsed = productFiltersSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid filters", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // Resolve a loja ativa pelos headers Host
    const activeLoja = await getLojaFromHeaders();
    if (!activeLoja) {
      return NextResponse.json(
        { error: "Loja não encontrada para este domínio" },
        { status: 404 }
      );
    }

    // Sobrescreve o filtro lojaId com a loja ativa resolvida para segurança
    const products = await productService.getProductsPage({
      ...parsed.data,
      lojaId: activeLoja.id,
    });
    return NextResponse.json(products.data, {
      status: 200,
      headers: {
        "X-Total-Count": String(products.total),
        "X-Page": String(products.page),
        "X-Page-Size": String(products.pageSize),
        "X-Has-Next-Page": String(products.hasNextPage),
        ...(products.nextCursor ? { "X-Next-Cursor": products.nextCursor } : {}),
        "Access-Control-Expose-Headers": "X-Total-Count, X-Page, X-Page-Size, X-Has-Next-Page, X-Next-Cursor",
      },
    });
  } catch (error) {
    logger.error("[PRODUCTS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // Enforce store isolation: lojaID and userID come from the verified session
    const product = await productService.createProduct({
      ...parsed.data,
      lojaID: guard.user.lojaID,
      userID: guard.user.id,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    logger.error("[PRODUCTS_POST]", error);

    if (error instanceof Error && error.message === "STORE_NOT_FOUND") {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
