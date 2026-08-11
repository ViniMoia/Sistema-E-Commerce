import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getCustomerProfile } from "@/services/customer.service";

type RouteContext = { params: { id: string } };

export async function GET(_req: Request, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const customer = await getCustomerProfile(params.id);
    return NextResponse.json(customer, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    console.error("[CUSTOMERS_ID_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
