import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

export async function POST(_req: Request) {
  try {
    await deleteSession();
  } catch (error) {
    console.error("[AUTH_LOGOUT_ERROR]", error);
  }
  // Behind Cloud Run, req.url may contain the internal container authority.
  // A fixed relative Location stays on the browser's current public origin,
  // including Vercel, without trusting forwarded host headers.
  return new NextResponse(null, { status: 303, headers: { Location: "/", "Cache-Control": "no-store" } });
}
