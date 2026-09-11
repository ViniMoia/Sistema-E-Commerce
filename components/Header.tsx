import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { LogOut, LayoutDashboard } from "lucide-react";
import { CartButton } from "./cart/CartButton";
import { MobileMenu } from "./MobileMenu";
import { ContinentalLogo } from "./brand/ContinentalLogo";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="w-full bg-[#000000] border-b border-white/[0.04]">
      {/* Container centralizado no eixo X alinhado com a grade do catálogo */}
      <div className="max-w-[1680px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12 h-16 md:h-20 flex items-center justify-between">
        
        {/* Lado Esquerdo: Símbolo da loja Continental (Brand Book Design System) */}
        <div className="flex items-center">
          <ContinentalLogo variant="symbol" className="h-9 sm:h-10 md:h-11 w-auto" priority />
        </div>

        {/* Lado Direito (Mobile): Cart e Menu Gaveta */}
        <div className="md:hidden flex items-center gap-4">
          <CartButton />
          <MobileMenu user={user} lojaName="Continental" />
        </div>

        {/* Lado Direito (Desktop): Cart, Login e Registro (Soltos, da esquerda para a direita) */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          {/* 1. Botão de Cart (solto, sem background próprio) */}
          <CartButton />

          {/* 2 & 3. Login e Registro (ou menu de usuário autenticado) */}
          {user ? (
            <div className="flex items-center gap-5">
              {user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="nav-trace-link flex items-center gap-1.5 text-brand-yellow text-xs sm:text-sm font-semibold uppercase tracking-[0.10em]"
                  title="Painel Administrativo"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Admin</span>
                </Link>
              )}

              <Link
                href="/profile"
                className="nav-trace-link flex items-center gap-2 text-white/90 hover:text-white text-xs sm:text-sm font-semibold tracking-wide"
              >
                <div className="w-7 h-7 rounded-full bg-brand-yellow/10 border border-brand-yellow/40 flex items-center justify-center overflow-hidden">
                  {user.avatarImageUrl ? (
                    <img
                      src={user.avatarImageUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-brand-yellow text-[10px] font-bold">
                      {user.name.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="hidden lg:inline">{user.name}</span>
              </Link>

              <form action="/api/auth/logout" method="POST" className="flex items-center">
                <button
                  type="submit"
                  className="text-white/60 hover:text-brand-yellow transition-colors cursor-pointer p-1"
                  title="Sair da conta"
                  aria-label="Sair da conta"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-6 lg:gap-8">
              {/* 2. Login (solto, com micro-interação fluida do traço que entra pela esquerda e sai pela direita) */}
              <Link
                href="/login"
                className="nav-trace-link text-xs sm:text-sm font-semibold uppercase tracking-[0.10em] text-white/90 hover:text-white"
                aria-label="Login"
              >
                Login
              </Link>

              {/* 3. Registro (solto, com micro-interação fluida do traço que entra pela esquerda e sai pela direita) */}
              <Link
                href="/register"
                className="nav-trace-link text-xs sm:text-sm font-semibold uppercase tracking-[0.10em] text-white/90 hover:text-white"
                aria-label="Registro"
              >
                Registro
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
