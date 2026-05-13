"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNavbar, MobileBottomNavigation } from "@/components/layout/AppNavbar";
import AppBreadcrumbs from "@/components/navigation/AppBreadcrumbs";

const PUBLIC_PATHS = new Set(["/onboarding", "/onboarding/success"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = pathname ? PUBLIC_PATHS.has(pathname) : false;

  if (isPublicPath) {
    return (
      <div className="rd-main">
        <AppBreadcrumbs />
        {children}
      </div>
    );
  }

  return (
    <div className="app-shell-root">
      <AppNavbar />
      <MobileBottomNavigation />
      <div className="app-shell-content rd-main">
        <AppBreadcrumbs />
        {children}
      </div>
    </div>
  );
}
