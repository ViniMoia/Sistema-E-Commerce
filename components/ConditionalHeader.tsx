"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

export function ConditionalHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [isRevealed, setIsRevealed] = useState(!isHomePage);

  useEffect(() => {
    // Se não for a página inicial, o header deve estar visível imediatamente
    if (!isHomePage) {
      setIsRevealed(true);
      return;
    }

    // Se já estiver com scroll na Home (ex: reload no meio da página), revelar de imediato
    if (typeof window !== "undefined" && window.scrollY > 60) {
      setIsRevealed(true);
      return;
    }

    // Na Home, o header só surge quando os textos e componentes da Hero surgem
    const handleHeroReveal = () => {
      setIsRevealed(true);
    };

    const handleScroll = () => {
      if (window.scrollY > 60) {
        setIsRevealed(true);
      }
    };

    window.addEventListener("hero-car-illuminated", handleHeroReveal);
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Fallback de segurança: se o vídeo for bloqueado pelo navegador, revelar após 3.8s
    const fallbackTimer = setTimeout(() => {
      setIsRevealed(true);
    }, 4000);

    return () => {
      window.removeEventListener("hero-car-illuminated", handleHeroReveal);
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(fallbackTimer);
    };
  }, [isHomePage]);

  // Rotas de administração possuem layout próprio
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-700 ease-out ${
        isRevealed
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-3 pointer-events-none"
      }`}
    >
      {children}
    </div>
  );
}
