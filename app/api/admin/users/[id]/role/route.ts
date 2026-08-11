import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { updateUserRole } from "@/services/user.service";

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "CUSTOMER"]),
});

type RouteContext = { params: { id: string } };

const SERVICE_ERRORS: Record<string, number> = {
  USER_NOT_FOUND: 404,
  CANNOT_CHANGE_OWN_ROLE: 422,
  USER_BLOCKED: 422,
  ROLE_ALREADY_SET: 422,
  LAST_ADMIN: 422,
};

function handleServiceError(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error.message in SERVICE_ERRORS) {
      return NextResponse.json(
        { error: error.message },
        { status: SERVICE_ERRORS[error.message] }
      );
    }
  } else if (typeof error === "string") {
    if (error === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  console.error("[ADMIN_USERS_ROLE_PATCH]", error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await requireAdmin();
    if (session instanceof NextResponse) return session;

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parseResult = updateRoleSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const updatedUser = await updateUserRole(
      params.id,
      session.user.id,
      parseResult.data.role
    );

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error) {
    return handleServiceError(error);
  }
}
