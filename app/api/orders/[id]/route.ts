import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/lib/auth/guards";
import { getOrderById, updateOrderStatus } from "@/services/order.service";
import { handleOrderError } from "@/lib/order-errors";
import { OrderStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const updateOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export async function GET(req: Request, context: RouteContext) {
  const guard = await requireAuth(req);
  if (guard instanceof NextResponse) return guard;

  const params = await context.params;
  try {
    const order = await getOrderById(params.id);

    // Controle de Acesso em Nível de Objeto (BOLA/IDOR - TEN-002):
    // - ADMINs só podem visualizar pedidos de sua própria loja
    // - CUSTOMERs só podem visualizar pedidos que lhes pertencem
    if (guard.user.role === "ADMIN") {
      if (order.lojaID !== guard.user.lojaID) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
    } else {
      if (order.userID !== guard.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    return handleOrderError(error);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const params = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const result = await updateOrderStatus({
      orderId: params.id,
      newStatus: parsed.data.status,
      performedById: guard.user.id,
      lojaID: guard.user.lojaID,
    });

    if (result.success === false) {
      return NextResponse.json(
        { error: result.error },
        { status: result.code === "NOT_FOUND" ? 404 : 422 }
      );
    }

    const order = await getOrderById(params.id);
    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    return handleOrderError(error);
  }
}
