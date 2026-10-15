import { NextRequest, NextResponse } from "next/server";
import { applicationMaintenanceActive } from "@/lib/application-maintenance";

/**
 * Convenção Proxy oficial do Next.js 16 (ARC-002, AUD2-008).
 * Substitui o antigo arquivo middleware.ts.
 */
export async function proxy(request: NextRequest) {
  // Run before auth/layouts, which may delete expired sessions even on GET.
  // Webhooks receive 503, never an acknowledgement for an unpersisted event.
  if (applicationMaintenanceActive()) {
    const headers = { 'Cache-Control': 'private, no-store' };
    if (request.nextUrl.pathname === '/api' || request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'APP_MAINTENANCE' }, { status: 503, headers });
    }
    return new NextResponse('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Manutenção temporária</title><body><main><h1>Estamos em manutenção</h1><p>A loja está temporariamente indisponível. Tente acessar novamente mais tarde.</p></main></body></html>',
      { status: 503, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const { pathname } = request.nextUrl;

  // Garante a validação de acesso apenas em rotas administrativas
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const sessionId = request.cookies.get("session_id")?.value;

  // Checagem rápida de presença física e formato básico do cookie de sessão.
  // Caso ausente, redireciona o usuário para a página de login.
  if (!sessionId || sessionId.length < 10) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Validação aprofundada de segurança (role, status do usuário e expiração)
  // é realizada no Layout Admin (app/admin/layout.tsx) e em requireAdmin.
  return NextResponse.next();
}

export const config = {
  // Include GET, Server Actions, API, assets and future routes; no suffix bypass.
  matcher: ["/:path*"],
};
