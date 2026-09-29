import { logger } from '@/lib/logger'
import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    await deleteSession();
    return NextResponse.redirect(new URL("/", req.url), 303);
  } catch (error) {
    logger.error("[AUTH_LOGOUT_ERROR]", error);
    return NextResponse.json(
      { error: "Não foi possível encerrar a sessão. Tente novamente." },
      { status: 503 }
    );
  }
}
