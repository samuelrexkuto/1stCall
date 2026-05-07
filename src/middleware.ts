import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { APP_SESSION_COOKIE } from "@/lib/auth/session";

const protectedPathPrefixes = [
  "/alerts",
  "/jobs",
  "/workers",
  "/workforce",
  "/providers",
  "/project-management",
  "/ai-hiring-assistant",
  "/account",
  "/dashboard",
];

const adminOnlyPathPrefixes = [
  "/providers",
  "/project-management",
  "/jobs/manual-entry",
  "/jobs/new",
  "/workers/new",
  "/workers/create",
];

const publicPathPrefixes = [
  "/",
  "/login",
  "/onboarding",
];

function decodeRole(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded));
    return parsed?.role === "job_provider" || parsed?.role === "admin" ? parsed.role : null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionCookie = request.cookies.get(APP_SESSION_COOKIE)?.value;
  const role = sessionCookie ? decodeRole(sessionCookie) : null;
  const isPublicPath = publicPathPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isProtectedPath = protectedPathPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isAdminOnlyPath = adminOnlyPathPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!role && isProtectedPath && !pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (role && isPublicPath && !isProtectedPath) {
    return NextResponse.next();
  }

  if (isAdminOnlyPath && role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = role ? "/" : "/login";
    url.search = role ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (role !== "job_provider") {
    return NextResponse.next();
  }

  if (pathname === "/dashboard/job-provider") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isAdminOnlyPath) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname.startsWith("/workers") ? "/workers" : "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
