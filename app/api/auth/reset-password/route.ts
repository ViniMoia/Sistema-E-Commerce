import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword, AuthError } from "@/services/auth.service";
import { rateLimit } from "@/lib/rate-limit";

const resetPasswordSchema = z.object({
  token: z.string().min(10, "Token de recuperação inválido."),
  password: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres."),
});

export async function POST(req: Request) {
  // 1. Rate Limiting por IP para mitigar ataques de força bruta sobre tokens
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "anonymous-client";
  const rl = rateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000);

  if (!rl.success) {
    return NextResponse.json(
      {
        error: "Muitas tentativas de redefinição de senha. Por favor, aguarde alguns minutos antes de tentar novamente.",
        retryAfter: rl.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfter),
        },
      }
    );
  }

  // 2. Leitura e validação do corpo
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição JSON inválido." }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos.",
        details: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  try {
    const result = await resetPassword({
      token: parsed.data.token,
      newPassword: parsed.data.password,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("[POST /api/auth/reset-password] Erro inesperado:", error);
    return NextResponse.json(
      { error: "Ocorreu um erro ao redefinir a senha. Tente novamente mais tarde." },
      { status: 500 }
    );
  }
}
