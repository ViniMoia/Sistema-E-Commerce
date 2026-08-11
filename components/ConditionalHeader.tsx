"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function ConditionalHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  if (pathname.startsWith("/admin")) {
    return null;
  }
  
  return <>{children}</>;
}
