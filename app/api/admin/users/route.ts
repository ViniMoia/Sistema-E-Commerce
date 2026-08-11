import { NextResponse } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth-admin";
import { listCustomers } from "@/services/admin.service";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    
    // O listCustomers do admin.service.ts lista todos os usuários (sem restrição de cargo)
    const result = await listCustomers({ search, cursor });
    
    return ok(result);
  } catch (error) {
    console.error("[ADMIN_USERS_GET]", error);
    return err("Internal Server Error", 500, "INTERNAL_ERROR");
  }
}
