import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validators/auth";
import { loginUser, AuthError } from "@/services/auth.service";
import { createSession } from "@/lib/session";
import { getLojaFromHeaders } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  // Proteção contra brute-force: 5 tentativas por minuto por IP (SEC-005)
  const rateLimitResponse = checkRateLimit(req, "auth_login", 5, 60000);
  if (rateLimitResponse) return rateLimitResponse;

  let activeLojaId: string | undefined;

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Validação com Zod
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Resolve a loja ativa pelo Host da requisição
    const activeLoja = await getLojaFromHeaders();
    if (!activeLoja) {
      return NextResponse.json(
        { error: "Loja não encontrada para este domínio" },
        { status: 404 }
      );
    }
    activeLojaId = activeLoja.id;

    // Autenticação com escopo de loja
    const user = await loginUser({
      email: parsed.data.email,
      password: parsed.data.password,
      lojaID: activeLoja.id,
    });

    // Criação de sessão segura com renovação de identificador (anti-fixation)
    await createSession(user.id);

    return NextResponse.json(
      {
        message: "Login realizado com sucesso",
        user,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    logger.error("Erro inesperado durante tentativa de login", error, {
      action: "AUTH_LOGIN",
      tenantId: activeLojaId,
    });
    return NextResponse.json(
      { error: "Erro ao fazer login" },
      { status: 500 }
    );
  }
}