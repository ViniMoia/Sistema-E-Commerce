import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getCustomerProfile } from "@/services/customer.service";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const params = await context.params;
  try {
    const customer = await getCustomerProfile({
      customerId: params.id,
      lojaID: guard.user.lojaID,
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(customer, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    logger.error("Erro ao buscar perfil de cliente", error, {
      action: "CUSTOMERS_ID_GET",
      customerId: params.id,
      tenantId: guard.user.lojaID,
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
