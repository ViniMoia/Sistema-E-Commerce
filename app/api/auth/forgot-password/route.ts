import { NextResponse } from "next/server";
import { z } from "zod";
import { getLojaFromHeaders, getTenantCanonicalOrigin } from "@/lib/tenant";
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
    // 3. Resolução de contexto multi-tenant fail-closed
    const activeLoja = await getLojaFromHeaders();
    if (!activeLoja) {
      return NextResponse.json(
        { error: "Contexto de loja não identificado." },
        { status: 404 }
      );
    }

    // Rate limiting adicional por hash da conta (mitigação direcionada a uma mesma vítima)
    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const accountHash = require("crypto")
      .createHash("sha256")
      .update(`${activeLoja.id}:${normalizedEmail}`)
      .digest("hex");
    const accountLimit = rateLimit(`forgot-password-account:${accountHash}`, 3, 15 * 60 * 1000);
    if (!accountLimit.success) {
      // Resposta uniforme anti-enumeração
      return NextResponse.json(
        {
          success: true,
          message:
            "Se o e-mail informado estiver cadastrado em nossa loja, você receberá as instruções para redefinição de senha em alguns instantes.",
        },
        { status: 200 }
      );
    }

    // 4. Origem canônica derivada exclusivamente de configuração confiável do tenant (Anti-Poisoning)
    const originUrl = getTenantCanonicalOrigin(activeLoja);
    if (!originUrl) {
      return NextResponse.json(
        { error: "Origem canônica da loja não configurada." },
        { status: 503 }
      );
    }

    // 5. Execução do serviço com proteção anti-enumeração
    await requestPasswordReset({
      email: normalizedEmail,
      lojaID: activeLoja.id,
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
