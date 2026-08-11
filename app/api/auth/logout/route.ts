import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    await deleteSession();
    return NextResponse.redirect(new URL("/", req.url), 303);
  } catch (error) {
    console.error("[AUTH_LOGOUT_ERROR]", error);
    return NextResponse.redirect(new URL("/", req.url), 303);
  }
}
