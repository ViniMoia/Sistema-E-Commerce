import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/lib/auth/guards";
import { getOrderById, updateOrderStatus } from "@/services/order.service";
import { handleOrderError } from "@/lib/order-errors";
import { OrderStatus } from "@prisma/client";
import { getLojaFromHeaders } from '@/lib/tenant';

type RouteContext = { params: Promise<{ id: string }> };

const updateOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  commandId: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/).optional(),
  expectedVersion: z.number().int().min(0).optional(),
});

export async function GET(req: Request, context: RouteContext) {
  const guard = await requireAuth(req);
  if (guard instanceof NextResponse) return guard;

  const params = await context.params;
  try {
    const tenant = await getLojaFromHeaders();
    if (!tenant) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
    if (tenant.id !== guard.user.lojaID) return NextResponse.json({ error: 'Sessão não autorizada para esta loja.' }, { status: 403 });
    const order = await getOrderById(params.id, { userID: guard.user.id, lojaID: tenant.id });

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
      if (order.lojaID !== guard.user.lojaID) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
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
    const tenant = await getLojaFromHeaders();
    if (!tenant) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
    if (tenant.id !== guard.user.lojaID) return NextResponse.json({ error: 'Sessão não autorizada para esta loja.' }, { status: 403 });
    const result = await updateOrderStatus({
      orderId: params.id,
      newStatus: parsed.data.status,
      performedById: guard.user.id,
      lojaID: guard.user.lojaID,
      actor: { type: 'USER', userId: guard.user.id, lojaID: tenant.id },
      commandId: parsed.data.commandId,
      expectedVersion: parsed.data.expectedVersion,
    });

    if (result.success === false) {
      return NextResponse.json(
        { error: result.error },
        { status: result.code === "NOT_FOUND" ? 404 : result.code === 'FORBIDDEN' ? 403 : 409 }
      );
    }

    const order = await getOrderById(params.id, { userID: guard.user.id, lojaID: tenant.id });
    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    return handleOrderError(error);
  }
}
