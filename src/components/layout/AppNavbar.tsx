"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AppDropdownMenu, DropdownMenu } from "@/components/ui/AppDropdownMenu";

const clientNavLinks = [
  { href: "/", label: "Home", public: true },
  { href: "/alerts", label: "Alerts", authRequired: true },
  { href: "/jobs", label: "Jobs Overview", authRequired: true },
  { href: "/workers", label: "Workforce Overview", authRequired: true },
  { href: "/ai-hiring-assistant", label: "AI Hiring Assistant", authRequired: true },
  { href: "/account", label: "Account", authRequired: true },
];

const adminNavLinks = [
  { href: "/", label: "Home", public: true },
  { href: "/alerts", label: "Alerts", authRequired: true },
  { href: "/jobs", label: "Jobs Overview", authRequired: true },
  { href: "/workers", label: "Workforce Overview", authRequired: true },
  { href: "/providers", label: "Project Management Overview", authRequired: true, adminOnly: true },
  { href: "/ai-hiring-assistant", label: "AI Hiring Assistant", authRequired: true },
  { href: "/jobs/manual-entry", label: "Manual Entry Job Post", authRequired: true, adminOnly: true },
  { href: "/workers/new", label: "Create Worker", authRequired: true, adminOnly: true },
  { href: "/account", label: "Account", authRequired: true },
];

type NavLink = (typeof adminNavLinks)[number];

const PROMO_BANNER_STORAGE_KEY = "rd-promo-banner-dismissed";
const PROMO_BANNER = {
  eyebrow: "Provider Update",
  text: "Portfolio-led workforce discovery and richer shortlist browsing are now live across the platform.",
  ctaLabel: "See Workforce Overview",
  ctaHref: "/workers",
};

type ThemeMode = "light" | "dark";
const THEME_STORAGE_KEY = "rd-theme";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

function applyThemeMode(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function AppNavbar() {
  const [open, setOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [promoDismissed, setPromoDismissed] = useState(true);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuthSession();

  const currentNavLinks = user?.role === "admin" ? adminNavLinks : clientNavLinks;
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const isAlertsActive = pathname === "/alerts" || Boolean(pathname?.startsWith("/alerts/"));
  const accountDisplayName = user
    ? user.role === "admin"
      ? user.name ?? user.email ?? "Admin"
      : user.providerName ?? user.name ?? "Subscriber Account"
    : "Guest";
  const accountDisplayTier = user ? (user.role === "admin" ? "Admin" : user.accessBadgeLabel ?? "Free Preview") : "Sign in for account access";

  function handleRestrictedNav(event: ReactMouseEvent, link: NavLink) {
    if (link.public) return;
    event.preventDefault();
    setOpen(false);

    if (!user) {
      router.push("/login");
      return;
    }

    if (link.adminOnly && user.role !== "admin") {
      router.push("/");
      return;
    }

    router.push(link.href);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  function toggleTheme() {
    const nextTheme = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextTheme);
    applyThemeMode(nextTheme);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPromoDismissed(window.localStorage.getItem(PROMO_BANNER_STORAGE_KEY) === "1");
    setThemeMode(getStoredTheme());
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      window.addEventListener("mousedown", handleOutsideClick);
    }

    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      window.addEventListener("keydown", handleEscape);
    }

    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <div ref={menuRef} className="app-navbar-shell">
      {!promoDismissed ? (
        <div className="app-navbar__promo-banner">
          <div className="app-navbar__promo-copy">
            <strong>{PROMO_BANNER.eyebrow}</strong>
            <span>{PROMO_BANNER.text}</span>
          </div>
          <div className="app-navbar__promo-actions">
            <Link href={PROMO_BANNER.ctaHref} className="app-navbar__promo-link">
              {PROMO_BANNER.ctaLabel}
            </Link>
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem(PROMO_BANNER_STORAGE_KEY, "1");
                setPromoDismissed(true);
              }}
              className="app-navbar__promo-dismiss"
              aria-label="Dismiss promotional banner"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      <header className="app-navbar">
        <div className="app-navbar__identity">
          <Link href="/" className="app-navbar__brand">
            <span className="app-navbar__brand-mark">
              RD
            </span>
            <span className="app-navbar__brand-text">Recruited Dispatch</span>
          </Link>

          <AppDropdownMenu
            align="start"
            side="bottom"
            trigger={
              <button
                type="button"
                className="app-navbar__mobile-profile-trigger"
                aria-label="Open account menu"
              >
                <ProfileAvatar user={user} />
                <span className="app-navbar__mobile-profile-copy">
                  <span className="app-navbar__mobile-profile-name">{accountDisplayName}</span>
                  <span className="app-navbar__mobile-profile-tier">{accountDisplayTier}</span>
                </span>
              </button>
            }
          >
            <AccountDropdownItems
              user={user}
              isLoginPage={isLoginPage}
              onLogout={handleLogout}
              onToggleTheme={toggleTheme}
              themeMode={themeMode}
            />
          </AppDropdownMenu>
        </div>

        <nav className="app-navbar__desktop-nav" aria-label="Primary">
          {currentNavLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            if (link.href === "/account") {
              return (
                <AppDropdownMenu
                  key={link.href}
                  align="end"
                  side="bottom"
                  trigger={
                    <button
                      type="button"
                      className={`app-navbar__desktop-link app-navbar__account-trigger${active ? " is-active" : ""}`}
                    >
                      {link.label}
                    </button>
                  }
                >
                  <AccountDropdownItems
                    user={user}
                    isLoginPage={isLoginPage}
                    onLogout={handleLogout}
                    onToggleTheme={toggleTheme}
                    themeMode={themeMode}
                  />
                </AppDropdownMenu>
              );
            }

            return (
            <Link
                key={link.href}
                href={link.href}
                onClick={(event) => handleRestrictedNav(event, link)}
                className={`app-navbar__desktop-link${active ? " is-active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-navbar__actions">
          <ThemeToggle />
          {user ? (
            <>
              <span className="app-navbar__role-pill">
                <span className="app-navbar__role-name">{accountDisplayName}</span>
                <span className="app-navbar__role-tier">{accountDisplayTier}</span>
              </span>
            </>
          ) : !isLoginPage ? (
            <button type="button" onClick={() => router.push("/login")} className="app-navbar__login-button">
              Login
            </button>
          ) : null}

          <Link
            href="/alerts"
            onClick={(event) => handleRestrictedNav(event, { href: "/alerts", label: "Alerts", authRequired: true })}
            className={`app-navbar__mobile-alerts${isAlertsActive ? " is-active" : ""}`}
            aria-label="Alerts"
          >
            <BellIcon />
          </Link>

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            className="app-navbar__menu-button"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M4 6H16M4 10H16M4 14H16"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {open ? (
        <div className="app-navbar__mobile-menu">
          <nav style={{ display: "grid", gap: "0.35rem" }}>
            {currentNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(event) => handleRestrictedNav(event, link)}
                className="app-navbar__mobile-link"
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <button type="button" onClick={handleLogout} className="app-navbar__mobile-link">
                Logout
              </button>
            ) : !isLoginPage ? (
              <button type="button" onClick={() => router.push("/login")} className="app-navbar__mobile-link">
                Login
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}

export function MobileBottomNavigation() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuthSession();

  const isHomeActive = pathname === "/";
  const isAccountActive = pathname === "/account" || Boolean(pathname?.startsWith("/account/"));
  const isDashboardActive =
    pathname === "/jobs" ||
    Boolean(pathname?.startsWith("/jobs/")) ||
    pathname === "/workers" ||
    Boolean(pathname?.startsWith("/workers/"));

  useEffect(() => {
    setThemeMode(getStoredTheme());
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  function toggleTheme() {
    const nextTheme = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextTheme);
    applyThemeMode(nextTheme);
  }

  function navigateDashboard(href: "/jobs" | "/workers") {
    if (!user) {
      router.push("/login");
      return;
    }

    router.push(href);
  }

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link href="/" className={`mobile-bottom-nav__item${isHomeActive ? " is-active" : ""}`} aria-label="Home">
          <HomeIcon />
          <span>Home</span>
        </Link>

        <AppDropdownMenu
          side="top"
          align="center"
          sideOffset={10}
          className="mobile-bottom-account-menu"
          trigger={
            <button
              type="button"
              className={`mobile-bottom-nav__item${isAccountActive ? " is-active" : ""}`}
              aria-label="Account menu"
            >
              <UserIcon />
              <span>Account</span>
            </button>
          }
        >
          <AccountDropdownItems
            user={user}
            isLoginPage={false}
            onLogout={handleLogout}
            onToggleTheme={toggleTheme}
            themeMode={themeMode}
          />
        </AppDropdownMenu>

        <AppDropdownMenu
          side="top"
          align="center"
          sideOffset={10}
          className="mobile-bottom-dashboard-menu"
          trigger={
            <button
              type="button"
              className={`mobile-bottom-nav__item${isDashboardActive ? " is-active" : ""}`}
              aria-label="Dashboard menu"
            >
              <DashboardIcon />
              <span>Dashboard</span>
            </button>
          }
        >
          <DropdownMenu.Item className="app-dropdown-item" onSelect={() => navigateDashboard("/jobs")}>
            Jobs Overview
          </DropdownMenu.Item>
          <DropdownMenu.Item className="app-dropdown-item" onSelect={() => navigateDashboard("/workers")}>
            Workforce Overview
          </DropdownMenu.Item>
        </AppDropdownMenu>
      </nav>
    </>
  );
}

function ProfileAvatar({ user }: { user: ReturnType<typeof useAuthSession>["user"] }) {
  const name = user?.role === "admin" ? user.name ?? user.email ?? "Admin" : user?.providerName ?? user?.name ?? "Guest";

  return (
    <span className="app-navbar__mobile-avatar-wrap" aria-hidden="true">
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="app-navbar__mobile-avatar" />
      ) : (
        <span className="app-navbar__mobile-avatar-fallback">{getInitials(name)}</span>
      )}
    </span>
  );
}

function AccountDropdownItems({
  user,
  onLogout,
  onToggleTheme,
  themeMode,
  isLoginPage,
}: {
  user: ReturnType<typeof useAuthSession>["user"];
  onLogout: () => void | Promise<void>;
  onToggleTheme: () => void;
  themeMode: ThemeMode;
  isLoginPage: boolean;
}) {
  const router = useRouter();

  function navigate(href: string) {
    router.push(href);
  }

  return (
    <>
      <DropdownMenu.Item className="app-dropdown-item" onSelect={() => navigate("/account")}>
        Account
      </DropdownMenu.Item>
      <DropdownMenu.Item className="app-dropdown-item" onSelect={() => navigate("/account?edit=profile")}>
        Edit profile
      </DropdownMenu.Item>
      {user?.role === "admin" ? (
        <DropdownMenu.Item className="app-dropdown-item" onSelect={() => navigate("/providers")}>
          Admin Dashboard
        </DropdownMenu.Item>
      ) : null}
      <DropdownMenu.Item className="app-dropdown-item" onSelect={onToggleTheme}>
        {themeMode === "dark" ? "Light mode" : "Dark mode"}
      </DropdownMenu.Item>
      <DropdownMenu.Separator className="app-dropdown-separator" />
      {user ? (
        <DropdownMenu.Item className="app-dropdown-item" onSelect={onLogout}>
          Log out
        </DropdownMenu.Item>
      ) : (
        <>
          {!isLoginPage ? (
            <DropdownMenu.Item className="app-dropdown-item" onSelect={() => navigate("/login")}>
              Log in
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item className="app-dropdown-item" onSelect={() => navigate("/login/job-provider")}>
            Sign up / Register
          </DropdownMenu.Item>
        </>
      )}
    </>
  );
}

function getInitials(value: string) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "RD";
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 9.8C18 6.5 15.8 4 12 4S6 6.5 6 9.8c0 5-2 5.7-2 7.2h16c0-1.5-2-2.2-2-7.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.8 19a2.3 2.3 0 0 0 4.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-4.2v-5.8H9.2V21H5a1 1 0 0 1-1-1v-9.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.8 20.2c1-3.2 3.6-5 7.2-5s6.2 1.8 7.2 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5h7v6H4V5ZM13 5h7v4h-7V5ZM13 11h7v8h-7v-8ZM4 13h7v6H4v-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
