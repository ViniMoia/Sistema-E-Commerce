"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function ConditionalHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  // Durante o redesign da Hero, o header é completamente removido da Home
  if (pathname.startsWith("/admin") || isHomePage) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[60]">
      {children}
    </div>
  );
}
