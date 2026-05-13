import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--app-bg)", color: "var(--app-text)" }}>
      {children}
    </div>
  );
}
