"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LogOut } from "lucide-react";
import { CartButton } from "./cart/CartButton";

interface MobileMenuProps {
  user: any;
  lojaName?: string;
}

export function MobileMenu({ user, lojaName = "Loja" }: MobileMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    <>
      {/* Hamburger Button */}
      <button 
        className="md:hidden pointer-events-auto bg-black/40 backdrop-blur-md p-2.5 rounded-full border border-white/10 text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 z-[70]"
        onClick={toggleMenu}
        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Backdrop Overlay */}
      <div 
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden transition-opacity duration-300 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Slide-in Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-[80vw] max-w-sm bg-[#0a0a0a] border-l border-white/10 z-[65] transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden flex flex-col pointer-events-auto ${
          menuOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full p-8 pt-24 gap-8 overflow-y-auto">
          {/* Logo inside menu */}
          <div className={`pb-6 border-b border-white/10 transition-all duration-500 delay-100 ease-[cubic-bezier(0.16,1,0.3,1)] ${menuOpen ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"}`}>
            <h2 className="text-sm font-bold tracking-widest text-white uppercase flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_var(--primary)]"></span>
              {lojaName}
            </h2>
          </div>

          <nav className="flex flex-col gap-6 flex-1">
            {user ? (
              <div className="flex flex-col gap-6">
                <Link 
                  href="/profile" 
                  onClick={toggleMenu}
                  className={`flex items-center gap-4 hover:text-primary transition-all duration-500 delay-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${menuOpen ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/50 flex items-center justify-center overflow-hidden">
                    {user.avatarImageUrl ? (
                      <img src={user.avatarImageUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary text-sm font-bold">{user.name.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white text-base font-medium">{user.name}</span>
                    <span className="text-xs text-neutral-500">Minha Conta</span>
                  </div>
                </Link>
                
                <form action="/api/auth/logout" method="POST" className={`mt-auto pt-6 border-t border-white/10 transition-all duration-500 delay-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${menuOpen ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"}`}>
                  <button type="submit" className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors w-full">
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium tracking-wide uppercase">Sair da conta</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-col gap-4 mt-4">
                <Link 
                  href="/login"
                  onClick={toggleMenu}
                  className={`w-full py-3 rounded-full border border-white/10 bg-black text-white text-center text-sm font-bold tracking-widest uppercase hover:bg-white/10 transition-all duration-500 delay-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${menuOpen ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"}`}
                >
                  Login
                </Link>
                
                <Link 
                  href="/register"
                  onClick={toggleMenu}
                  className={`w-full py-3 rounded-full bg-white text-black text-center text-sm font-bold tracking-widest uppercase hover:bg-neutral-200 transition-all duration-500 delay-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${menuOpen ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"}`}
                >
                  Inscrever-se
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </>
  );
}
