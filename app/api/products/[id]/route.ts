import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import * as productService from "@/services/product.service";
import { updateProductSchema } from "@/lib/validators/product";
import { getLojaFromHeaders } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

// ─── Error → HTTP status map ──────────────────────────────────────────────────
const SERVICE_ERRORS: Record<string, number> = {
  PRODUCT_NOT_FOUND: 404,
  STORE_NOT_FOUND: 404,
  PRODUCT_IN_USE: 409,
};

function handleServiceError(error: unknown): NextResponse {
  if (error instanceof productService.ProductVariantError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  if (error instanceof Error && error.message in SERVICE_ERRORS) {
    return NextResponse.json(
      { error: error.message },
      { status: SERVICE_ERRORS[error.message] }
    );
  }
  console.error("[PRODUCTS_ID]", error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const activeLoja = await getLojaFromHeaders();
    const product = await productService.getProductById(params.id, activeLoja?.id);
    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const params = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // Passa o lojaID do admin autenticado para impedir alteração cross-tenant (TEN-002)
    const product = await productService.updateProduct(
      params.id,
      parsed.data,
      guard.user.lojaID,
      guard.user.id
    );
    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const params = await context.params;
    // Passa o lojaID do admin autenticado para impedir deleção cross-tenant (TEN-002)
    await productService.deleteProduct(params.id, guard.user.lojaID, guard.user.id);

    // 204 No Content — body must be empty
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleServiceError(error);
  }
}
