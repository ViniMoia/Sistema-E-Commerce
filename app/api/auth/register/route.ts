import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validators/auth";
import { registerUser } from "@/services/auth.service";
import { createSession } from "@/lib/session";
import { getLojaFromHeaders } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Proteção contra brute-force / spam registration: 5 tentativas por minuto por IP (SEC-005)
  const rateLimitResponse = checkRateLimit(req, "auth_register", 5, 60000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Validação formal com Zod (P1-002 / ACT-005)
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados cadastrais inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const activeLoja = await getLojaFromHeaders();
    if (!activeLoja) {
      return NextResponse.json(
        { error: "Loja não encontrada para este domínio" },
        { status: 404 }
      );
    }

    const user = await registerUser({
      ...parsed.data,
      lojaID: activeLoja.id,
    });

    // Criação de sessão segura (anti-fixation)
    await createSession(user.id);

    return NextResponse.json(
      {
        message: "Usuário registrado com sucesso",
        user,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("API Error in /api/auth/register:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao registrar usuário" },
      { status: 400 }
    );
  }
}
