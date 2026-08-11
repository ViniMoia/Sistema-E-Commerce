import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";

// 7 days expiration
const SESSION_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_MS);
  const sessionId = randomBytes(32).toString("hex");

  const session = await prisma.session.create({
    data: { id: sessionId, userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set("session_id", session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });

  return session;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  
  if (sessionId) {
    try {
      await prisma.session.delete({ where: { id: sessionId } });
    } catch (error) {
      console.error("Failed to delete session from DB:", error);
    }
  }

  cookieStore.delete("session_id");
}

import { cache } from "react";

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  
  if (!sessionId) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            avatarImageUrl: true,
            lojaID: true,
          },
        },
      },
    });

    if (!session) return null;

    // Inline cleanup of expired sessions
    if (session.expiresAt < new Date()) {
      await deleteSession();
      return null;
    }

    if (session.user.status === "BLOCKED") return null;

    return session.user;
  } catch (error) {
    console.error("Failed to fetch session/user:", error);
    return null;
  }
});
