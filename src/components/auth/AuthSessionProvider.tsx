"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppSessionUser } from "@/lib/auth/types";

interface AuthSessionContextValue {
  user: AppSessionUser | null;
  setUser: (user: AppSessionUser | null) => void;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({
  initialUser,
  children,
}: {
  initialUser: AppSessionUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<AppSessionUser | null>(initialUser);
  const value = useMemo(() => ({ user, setUser }), [user]);

  useEffect(() => {
    if (user?.role !== "job_provider") return;
    let cancelled = false;

    async function refreshAccount() {
      const response = await fetch("/api/account", { cache: "no-store" }).catch(() => null);
      if (!response || cancelled) return;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success || cancelled || !payload.user) return;
      setUser(payload.user as AppSessionUser);
    }

    function handleFocus() {
      void refreshAccount();
    }

    window.addEventListener("focus", handleFocus);
    const interval = window.setInterval(refreshAccount, 30000);
    void refreshAccount();

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(interval);
    };
  }, [user?.role, user?.providerId]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider.");
  }

  return context;
}
