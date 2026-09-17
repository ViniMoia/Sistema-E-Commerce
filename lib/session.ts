import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";
import * as React from "react";
import { sanitizeUser, SafeUserDTO } from "@/lib/utils/dto-sanitizer";

// 7 dias de expiração de sessão
const SESSION_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cria uma nova sessão no banco e define o cookie HTTP seguro.
 * DEFESA CONTRA SESSION FIXATION (Finding SEC-005):
 * Se a requisição já possuir um cookie de sessão pré-existente (anônimo ou antigo),
 * essa sessão é explicitamente destruída no banco e limpa antes de gerar a nova.
 */
export async function createSession(userId: string) {
  const cookieStore = await cookies();
  const existingSessionId = cookieStore.get("session_id")?.value;

  // 1. Invalidar sessão anterior se existente
  if (existingSessionId) {
    try {
      await prisma.session.deleteMany({
        where: { id: existingSessionId },
      });
    } catch {
      // no-op se a sessão já não existia
    }
  }

  // 2. Gerar novo identificador criptograficamente seguro de 256 bits
  const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_MS);
  const sessionId = randomBytes(32).toString("hex");

  const session = await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  // 3. Gravar novo cookie de sessão com flags de segurança reforçadas
  cookieStore.set("session_id", session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });

  return session;
}

/**
 * Encerra e remove a sessão atual no banco e no cliente
 */
export async function deleteSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;

  if (sessionId) {
    try {
      await prisma.session.deleteMany({
        where: { id: sessionId },
      });
    } catch (error) {
      console.error("Falha ao deletar sessão do banco:", error);
    }
  }

  cookieStore.delete("session_id");
}

const cacheFn = typeof React.cache === "function" ? React.cache : ((fn: any) => fn);

/**
 * Obtém o usuário associado à sessão atual na requisição.
 * - Invalida automaticamente sessões expiradas.
 * - Bloqueia usuários com status BLOCKED.
 * - Retorna apenas campos sanitizados (SafeUserDTO).
 */
export const getCurrentUser = cacheFn(async (): Promise<SafeUserDTO | null> => {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) return null;
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
            phone: true,
            lojaID: true,
            createdAt: true,
            updatedAt: true,
            defaultAddressId: true,
          },
        },
      },
    });

    if (!session) return null;

    // Limpeza em linha de sessões expiradas
    if (session.expiresAt < new Date()) {
      await deleteSession();
      return null;
    }

    if (session.user.status === "BLOCKED") {
      return null;
    }

    return sanitizeUser(session.user);
  } catch (error: any) {
    if (error?.message?.includes("cookies") || error?.digest === "DYNAMIC_SERVER_USAGE") {
      return null;
    }
    console.error("Falha ao consultar sessão/usuário:", error);
    return null;
  }
});
