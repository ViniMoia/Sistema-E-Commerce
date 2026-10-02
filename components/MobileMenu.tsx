"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Home,
  ShoppingBag,
  ShoppingCart,
  User,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { useCartStore } from "@/store/cart.store";
import { ContinentalLogo } from "./brand/ContinentalLogo";

interface MobileMenuUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  avatarImageUrl?: string | null;
}

interface MobileMenuProps {
  user?: MobileMenuUser | null;
  lojaName?: string;
  whatsappNumber?: string | null;
}

export function MobileMenu({
  user,
  lojaName = "Continental",
  whatsappNumber,
}: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  const { setIsOpen: setCartOpen } = useCart();
  const { cart } = useCartStore();

  const cartItemCount =
    cart?.items?.reduce((total, item) => total + item.quantity, 0) || 0;

  // Garantir montagem no client para evitar SSR hydration mismatch no portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloqueio de scroll do body e listener para fechar com tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeMenu = () => {
    document.body.style.overflow = "";
    setIsOpen(false);
  };

  const handleNavigateHome = (e: React.MouseEvent) => {
    closeMenu();
    if (pathname === "/") {
      e.preventDefault();
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 50);
    }
  };

  const handleNavigateCatalog = (e: React.MouseEvent) => {
    closeMenu();
    if (pathname === "/") {
      e.preventDefault();
      setTimeout(() => {
        const catalogEl = document.getElementById("catalogo");
        if (catalogEl) {
          catalogEl.scrollIntoView({ behavior: "smooth" });
        } else {
          window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
        }
      }, 50);
    }
  };

  const handleOpenCart = () => {
    closeMenu();
    // Pequeno intervalo para transição suave de abertura do carrinho
    setTimeout(() => {
      setCartOpen(true);
    }, 180);
  };

  const cleanWhatsappNumber = (
    whatsappNumber || "5591992891293"
  ).replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent(
    "Olá! Estou navegando na loja Continental e gostaria de tirar uma dúvida."
  )}`;

  return (
    <>
      {/* Botão Gatilho Hamburger no Cabeçalho (Exclusivo Mobile) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="md:hidden relative inline-flex items-center justify-center p-2 rounded-xl text-white/90 hover:text-white bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/60 cursor-pointer"
        aria-label="Abrir menu de navegação"
        aria-expanded={isOpen}
      >
        <Menu className="w-5 h-5 text-white" />
      </button>

      {/* Gaveta Lateral Renderizada via Portal (Resolve Stacking Context do Header) */}
      {mounted &&
        createPortal(
          <div
            className={`fixed inset-0 z-[100] md:hidden transition-all duration-300 ${
              isOpen
                ? "visible pointer-events-auto"
                : "invisible pointer-events-none"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
          >
            {/* Backdrop Translúcido Escuro (atrás da gaveta z-[100]) */}
            <div
              className={`fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
                isOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeMenu}
              aria-hidden="true"
            />

            {/* Painel Lateral Drawer (z-[101] acima do backdrop) */}
            <div
              className={`fixed top-0 right-0 bottom-0 w-[85vw] max-w-sm h-full bg-[#080B11] border-l border-white/10 shadow-2xl flex flex-col z-[101] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              {/* Cabeçalho do Drawer */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-black/60 shrink-0">
                <ContinentalLogo
                  variant="symbol"
                  className="h-8 w-auto"
                  href="/"
                  onClick={handleNavigateHome}
                />

                <button
                  type="button"
                  onClick={closeMenu}
                  className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-white/90 hover:text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/60 cursor-pointer"
                  aria-label="Fechar menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Conteúdo com Scroll */}
              <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
                {/* 1. Navegação Principal */}
                <div>
                  <span className="text-[11px] font-bold tracking-[0.15em] text-neutral-400 uppercase block mb-2 px-1">
                    Navegação
                  </span>
                  <nav className="flex flex-col gap-1">
                    <Link
                      href="/"
                      onClick={handleNavigateHome}
                      className="flex items-center justify-between px-3.5 py-3 rounded-xl text-neutral-200 hover:text-white hover:bg-white/[0.05] transition-colors group min-h-[44px]"
                    >
                      <div className="flex items-center gap-3">
                        <Home className="w-4 h-4 text-neutral-400 group-hover:text-brand-yellow transition-colors" />
                        <span className="text-sm font-medium">Início</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                    </Link>

                    <Link
                      href="/#catalogo"
                      onClick={handleNavigateCatalog}
                      className="flex items-center justify-between px-3.5 py-3 rounded-xl text-neutral-200 hover:text-white hover:bg-white/[0.05] transition-colors group min-h-[44px]"
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingBag className="w-4 h-4 text-neutral-400 group-hover:text-brand-yellow transition-colors" />
                        <span className="text-sm font-medium">Catálogo de Produtos</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                    </Link>

                    <button
                      type="button"
                      onClick={handleOpenCart}
                      className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-neutral-200 hover:text-white hover:bg-white/[0.05] transition-colors group min-h-[44px] text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingCart className="w-4 h-4 text-neutral-400 group-hover:text-brand-yellow transition-colors" />
                        <span className="text-sm font-medium">Meu Carrinho</span>
                      </div>
                      {cartItemCount > 0 ? (
                        <span className="px-2 py-0.5 text-xs font-bold bg-brand-yellow text-black rounded-full shadow-[0_0_8px_rgba(240,180,14,0.4)]">
                          {cartItemCount}
                        </span>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                      )}
                    </button>
                  </nav>
                </div>

                {/* 2. Área do Cliente / Autenticação */}
                <div className="pt-2 border-t border-white/[0.08]">
                  <span className="text-[11px] font-bold tracking-[0.15em] text-neutral-400 uppercase block mb-2 px-1">
                    {user ? "Minha Conta" : "Acesso do Cliente"}
                  </span>

                  {user ? (
                    <div className="space-y-3">
                      {/* Card do Usuário Autenticado */}
                      <div className="flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <div className="w-10 h-10 rounded-full bg-brand-yellow/10 border border-brand-yellow/40 flex items-center justify-center overflow-hidden shrink-0">
                          {user.avatarImageUrl ? (
                            <img
                              src={user.avatarImageUrl}
                              alt="Avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-brand-yellow text-xs font-bold">
                              {(user.name || "U").substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-white text-sm font-semibold truncate">
                            {user.name || "Cliente"}
                          </span>
                          <span className="text-neutral-400 text-xs truncate">
                            {user.email || "Conectado"}
                          </span>
                        </div>
                      </div>

                      {/* Links do Usuário */}
                      <div className="flex flex-col gap-1">
                        {user.role === "ADMIN" && (
                          <Link
                            href="/admin"
                            onClick={closeMenu}
                            className="flex items-center justify-between px-3.5 py-3 rounded-xl text-brand-yellow hover:bg-brand-yellow/10 border border-brand-yellow/20 transition-colors min-h-[44px]"
                          >
                            <div className="flex items-center gap-3">
                              <LayoutDashboard className="w-4 h-4" />
                              <span className="text-sm font-semibold uppercase tracking-wider">
                                Painel Administrativo
                              </span>
                            </div>
                            <ShieldCheck className="w-4 h-4" />
                          </Link>
                        )}

                        <Link
                          href="/profile"
                          onClick={closeMenu}
                          className="flex items-center justify-between px-3.5 py-3 rounded-xl text-neutral-200 hover:text-white hover:bg-white/[0.05] transition-colors group min-h-[44px]"
                        >
                          <div className="flex items-center gap-3">
                            <User className="w-4 h-4 text-neutral-400 group-hover:text-brand-yellow transition-colors" />
                            <span className="text-sm font-medium">Meu Perfil e Pedidos</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                        </Link>

                        <form action="/api/auth/logout" method="POST">
                          <button
                            type="submit"
                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors min-h-[44px] text-left cursor-pointer"
                          >
                            <LogOut className="w-4 h-4" />
                            <span className="text-sm font-medium">Sair da conta</span>
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Faça login para acompanhar seus pedidos, endereços e vantagens exclusivas.
                      </p>
                      <div className="flex flex-col gap-2 pt-1">
                        <Link
                          href="/login"
                          onClick={closeMenu}
                          className="w-full py-2.5 px-4 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-center text-xs font-bold tracking-wider uppercase transition-colors min-h-[44px] flex items-center justify-center"
                        >
                          Entrar
                        </Link>
                        <Link
                          href="/register"
                          onClick={closeMenu}
                          className="w-full py-2.5 px-4 rounded-lg bg-brand-yellow hover:bg-yellow-400 text-black text-center text-xs font-bold tracking-wider uppercase shadow-[0_0_12px_rgba(240,180,14,0.3)] transition-colors min-h-[44px] flex items-center justify-center"
                        >
                          Cadastre-se
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Atendimento e Suporte */}
                <div className="pt-2 border-t border-white/[0.08]">
                  <span className="text-[11px] font-bold tracking-[0.15em] text-neutral-400 uppercase block mb-2 px-1">
                    Atendimento
                  </span>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeMenu}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors min-h-[44px]"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Fale Conosco no WhatsApp</span>
                      <span className="text-[11px] text-emerald-400/80">Tire suas dúvidas em tempo real</span>
                    </div>
                  </a>
                </div>
              </div>

              {/* Rodapé do Drawer */}
              <div className="px-5 py-4 border-t border-white/[0.08] bg-black/70 text-center shrink-0">
                <span className="text-[11px] text-neutral-500 tracking-wide font-sans block">
                  © {new Date().getFullYear()} {lojaName}. Estética Automotiva de Alta Precisão.
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

