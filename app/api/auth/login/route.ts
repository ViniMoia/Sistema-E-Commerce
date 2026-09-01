import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validators/auth";
import { loginUser, AuthError } from "@/services/auth.service";
import { createSession } from "@/lib/session";
import { getLojaFromHeaders } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Proteção contra brute-force: 5 tentativas por minuto por IP (SEC-005)
  const rateLimitResponse = checkRateLimit(req, "auth_login", 5, 60000);
  if (rateLimitResponse) return rateLimitResponse;

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

    // Autenticação com escopo de loja
    const user = await loginUser({
      ...parsed.data,
      lojaID: activeLoja.id,
    });

    // Criação de sessão na base de dados + Cookie
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

    console.error("Login route error:", error);
    return NextResponse.json(
      { error: "Erro ao fazer login" },
      { status: 500 }
    );
  }
}