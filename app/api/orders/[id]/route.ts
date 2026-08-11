import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/lib/auth/guards";
import { getOrderById, updateOrderStatus } from "@/services/order.service";
import { handleOrderError } from "@/lib/order-errors";
import { OrderStatus } from "@prisma/client";

type RouteContext = { params: { id: string } };

const updateOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export async function GET(_req: Request, { params }: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const order = await getOrderById(params.id);

    // Access control: customers can only view their own orders.
    // ADMINs can view any order.
    // The service itself doesn't carry requestingUserId — this check lives here
    // because it's a simple ownership assertion, not a business rule.
    if (
      guard.user.role !== "ADMIN" &&
      order.userID !== guard.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    return handleOrderError(error);
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

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
    await updateOrderStatus({
      orderId: params.id,
      newStatus: parsed.data.status,
      performedById: guard.user.id,
    });

    // Return the updated order so the client doesn't need a second request
    const order = await getOrderById(params.id);
    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    return handleOrderError(error);
  }
}
