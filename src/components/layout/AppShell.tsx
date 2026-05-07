"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNavbar, MobileBottomNavigation } from "@/components/layout/AppNavbar";

const PUBLIC_PATHS = new Set(["/onboarding", "/onboarding/success"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = pathname ? PUBLIC_PATHS.has(pathname) : false;

  if (isPublicPath) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell-root">
      <AppNavbar />
      <MobileBottomNavigation />
      <div className="app-shell-content">
        {children}
      </div>
    </div>
  );
}
