import { NextResponse } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth-admin";
import { listCustomers } from "@/services/customer.service";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const customers = await listCustomers({});
    return ok(customers);
  } catch (error) {
    console.error("[CUSTOMERS_GET]", error);
    return err("Internal Server Error", 500, "INTERNAL_ERROR");
  }
}


