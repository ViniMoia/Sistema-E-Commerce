import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/lib/auth/guards";
import { createOrderFromCart, getOrdersByUser } from "@/services/order.service";
import { handleOrderError } from "@/lib/order-errors";

const createOrderSchema = z.object({
  cartID: z.string().uuid(),
  addressID: z.string().uuid(),
  lojaID: z.string(),
});

export async function POST(req: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const order = await createOrderFromCart({
      userID: guard.user.id,          // userId always from session
      cartID: parsed.data.cartID,
      addressID: parsed.data.addressID,
      lojaID: parsed.data.lojaID,
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return handleOrderError(error);
  }
}

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    // ADMIN sees all orders; CUSTOMER sees only their own.
    // getOrdersByUser with no filter would require a service change —
    // for now, role-based branching happens here since the service contract
    // only accepts a userId. An admin passing their own id would be wrong.
    const targetUserId = guard.user.role === "ADMIN" ? undefined : guard.user.id;

    const orders = await getOrdersByUser(targetUserId as string);
    return NextResponse.json(orders, { status: 200 });
  } catch (error) {
    return handleOrderError(error);
  }
}
