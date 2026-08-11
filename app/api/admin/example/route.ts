import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";

export async function GET() {
  const result = await requireAdmin();

  if (result instanceof NextResponse) return result;

  const { user } = result;

  // user is typed as the authenticated ADMIN — safe to use
  return NextResponse.json({ message: `Hello, ${user.name}` });
}
