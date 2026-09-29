"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function ConditionalHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Rotas de administração possuem layout próprio
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <div className="pointer-events-auto fixed left-0 right-0 top-0 z-[60] translate-y-0 opacity-100">
      {children}
    </div>
  );
}
