import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
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
  // é realizada com cache no Server Component do Layout Admin (app/admin/layout.tsx)
  // e nas APIs correspondentes pelo método requireAdmin.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

