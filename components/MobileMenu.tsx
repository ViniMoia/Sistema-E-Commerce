"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, LogOut } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileMenuProps {
  user: any;
  lojaName?: string;
}

export function MobileMenu({ user, lojaName = "Loja" }: MobileMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="md:hidden pointer-events-auto bg-black/40 backdrop-blur-md p-2.5 rounded-full border border-white/10 text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary z-[70]"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="md:hidden w-[80vw] max-w-sm bg-[#0a0a0a] border-white/10 text-white p-8 pt-20 flex flex-col"
      >
        <SheetTitle className="text-sm font-bold tracking-widest text-white uppercase flex items-center gap-2 pb-4 border-b border-white/10">
          <span className="w-2 h-2 bg-primary rounded-full" aria-hidden="true" />
          {lojaName}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Navegação da conta e acesso à loja.
        </SheetDescription>

        <nav aria-label="Menu principal móvel" className="flex flex-col gap-6 flex-1 mt-8">
          {user ? (
            <div className="flex flex-col gap-6 h-full">
              <SheetClose asChild>
                <Link
                  href="/profile"
                  className="flex items-center gap-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/50 flex items-center justify-center overflow-hidden">
                    {user.avatarImageUrl ? (
                      <img src={user.avatarImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary text-sm font-bold" aria-hidden="true">
                        {user.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white text-base font-medium">{user.name}</span>
                    <span className="text-xs text-neutral-500">Minha Conta</span>
                  </div>
                </Link>
              </SheetClose>

              <form action="/api/auth/logout" method="POST" className="mt-auto pt-6 border-t border-white/10">
                <button
                  type="submit"
                  className="flex items-center gap-3 text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded transition-colors w-full"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium tracking-wide uppercase">Sair da conta</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-4 mt-4">
              <SheetClose asChild>
                <Link
                  href="/login"
                  className="w-full py-3 rounded-full border border-white/10 bg-black text-white text-center text-sm font-bold tracking-widest uppercase hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Login
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/register"
                  className="w-full py-3 rounded-full bg-brand-yellow text-black text-center text-sm font-bold tracking-widest uppercase hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Registro
                </Link>
              </SheetClose>
            </div>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
