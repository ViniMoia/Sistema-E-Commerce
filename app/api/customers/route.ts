import { NextResponse } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth-admin";
import { listCustomers } from "@/services/customer.service";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const customers = await listCustomers({ lojaID: auth.user.lojaID });
    return ok(customers);
  } catch (error) {
    logger.error("Erro ao listar clientes", error, {
      action: "CUSTOMERS_GET",
      tenantId: auth.user.lojaID,
    });
    return err("Internal Server Error", 500, "INTERNAL_ERROR");
  }
}


