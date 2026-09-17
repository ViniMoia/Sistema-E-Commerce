import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { createOrderFromCart, getOrdersByUser } from "@/services/order.service";
import { handleOrderError } from "@/lib/order-errors";
import { getLojaFromHeaders } from "@/lib/tenant";

const createOrderSchema = z.object({
  cartID: z.string().uuid(),
  addressID: z.string().uuid(),
  lojaID: z.string().optional(),
});

export async function POST(req: Request) {
  const guard = await requireAuth(req);
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
    const activeLoja = await getLojaFromHeaders();
    const authoritativeLojaId = activeLoja?.id || guard.user.lojaID || parsed.data.lojaID;

    if (!authoritativeLojaId) {
      return NextResponse.json(
        { error: "Contexto de loja não identificado." },
        { status: 400 }
      );
    }

    // Bloqueia tentativa de spoofing cross-tenant se o payload divergente da loja ativa
    if (parsed.data.lojaID && activeLoja && parsed.data.lojaID !== activeLoja.id) {
      return NextResponse.json(
        { error: "Loja inválida ou inconsistente com o domínio ativo." },
        { status: 403 }
      );
    }

    const order = await createOrderFromCart({
      userID: guard.user.id,          // userId always from session
      cartID: parsed.data.cartID,
      addressID: parsed.data.addressID,
      lojaID: authoritativeLojaId,
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return handleOrderError(error);
  }
}

export async function GET(req?: Request) {
  const guard = await requireAuth(req);
  if (guard instanceof NextResponse) return guard;

  try {
    const activeLoja = await getLojaFromHeaders();
    const lojaID = activeLoja?.id || guard.user.lojaID;

    if (!lojaID) {
      return NextResponse.json(
        { error: "Contexto de loja não identificado." },
        { status: 400 }
      );
    }

    // Isolamento estrito por tenant: cliente só enxerga seus próprios pedidos na loja ativa
    const orders = await getOrdersByUser({
      userID: guard.user.id,
      lojaID,
    });
    return NextResponse.json(orders, { status: 200 });
  } catch (error) {
    return handleOrderError(error);
  }
}
