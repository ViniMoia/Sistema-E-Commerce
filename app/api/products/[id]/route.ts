import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import * as productService from "@/services/product.service";
import { updateProductSchema } from "@/lib/validators/product";

type RouteContext = { params: { id: string } };

// ─── Error → HTTP status map ──────────────────────────────────────────────────
const SERVICE_ERRORS: Record<string, number> = {
  PRODUCT_NOT_FOUND: 404,
  STORE_NOT_FOUND: 404,
};

function handleServiceError(error: unknown): NextResponse {
  if (error instanceof Error && error.message in SERVICE_ERRORS) {
    return NextResponse.json(
      { error: error.message },
      { status: SERVICE_ERRORS[error.message] }
    );
  }
  console.error("[PRODUCTS_ID]", error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const product = await productService.getProductById(params.id);
    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

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

    const product = await productService.updateProduct(params.id, parsed.data);
    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await productService.deleteProduct(params.id);

    // 204 No Content — body must be empty
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleServiceError(error);
  }
}
