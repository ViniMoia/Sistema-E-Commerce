import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getLojaFromHeaders } from "@/lib/tenant";
import { requestPasswordReset } from "@/services/auth.service";
import { rateLimit } from "@/lib/rate-limit";

const forgotPasswordSchema = z.object({
  email: z.string().email("Formato de e-mail inválido"),
});

export async function POST(req: Request) {
  // 1. Rate Limiting por IP (Mitigação de E-mail Bombing e DoS)
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "anonymous-client";
  const rl = rateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000); // 5 requisições a cada 15 min

  if (!rl.success) {
    return NextResponse.json(
      {
        error: "Muitas tentativas de recuperação de senha. Por favor, aguarde alguns minutos antes de tentar novamente.",
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

  // 2. Leitura e validação do corpo da requisição
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição JSON inválido." }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
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
    // 3. Resolução de contexto multi-tenant
    const activeLoja = await getLojaFromHeaders();
    let lojaID = activeLoja?.id || process.env.NEXT_PUBLIC_LOJA_ID;

    if (!lojaID) {
      // Fallback seguro para primeira loja cadastrada
      const defaultStore = await prisma.loja.findFirst({
        select: { id: true },
      });
      lojaID = defaultStore?.id;
    }

    if (!lojaID) {
      return NextResponse.json(
        { error: "Contexto de loja não identificado." },
        { status: 400 }
      );
    }

    // 4. Resolução da URL base para o link do e-mail
    const origin = req.headers.get("origin") || req.headers.get("referer");
    const originUrl = origin ? new URL(origin).origin : process.env.NEXT_PUBLIC_APP_URL;

    // 5. Execução do serviço com proteção anti-enumeração
    await requestPasswordReset({
      email: parsed.data.email,
      lojaID,
      originUrl,
    });

    // 6. Resposta padronizada e segura
    return NextResponse.json(
      {
        success: true,
        message:
          "Se o e-mail informado estiver cadastrado em nossa loja, você receberá as instruções para redefinição de senha em alguns instantes.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[POST /api/auth/forgot-password] Erro inesperado:", error);
    return NextResponse.json(
      {
        error: "Ocorreu um erro interno ao processar a solicitação. Tente novamente mais tarde.",
      },
      { status: 500 }
    );
  }
}
