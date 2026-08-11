import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

type AuthedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
type GuardResult<T = AuthedUser> = { user: T } | NextResponse;

/**
 * Use in Node.js API Routes only (not in middleware — Prisma requires Node.js runtime).
 * Returns { user } for ADMIN sessions, or a ready-to-return NextResponse error.
 */
export async function requireAdmin(): Promise<GuardResult> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // user.status === "ACTIVE" is already enforced inside getCurrentUser()
  return { user };
}

/**
 * Returns { user } for any authenticated active session (ADMIN or CUSTOMER).
 */
export async function requireAuth(): Promise<GuardResult> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { user };
}
