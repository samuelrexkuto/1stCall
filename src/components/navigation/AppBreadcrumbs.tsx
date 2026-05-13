"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Slot } from "@radix-ui/react-slot";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Crumb = {
  href: string;
  label: string;
};

const ROUTE_LABELS: Record<string, string> = {
  "/": "Home",
  "/home": "Home",
  "/account": "Account",
  "/dashboard": "Dashboard",
  "/dashboard/job-provider": "Dashboard",
  "/dashboard/job-provider/account": "Account",
  "/admin": "Admin",
  "/admin/project-management": "Project Management",
  "/admin/create-subscriber": "Create Subscriber",
  "/admin/jobs": "Jobs",
  "/alerts": "Alerts",
  "/jobs": "Jobs Overview",
  "/jobs-overview": "Jobs Overview",
  "/providers": "Project Management",
  "/providers/new": "Create Subscriber",
  "/workforce-overview": "Workforce Overview",
  "/workers": "Workforce Overview",
  "/ai-hiring-assistant": "AI Hiring Assistant",
};

function titleFromSegment(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildCrumbs(pathname: string): Crumb[] {
  const cleanPath = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  const segments = cleanPath.split("/").filter(Boolean);

  const crumbs: Crumb[] = [
    {
      href: "/",
      label: "Home",
    },
  ];

  let current = "";

  for (const segment of segments) {
    current += `/${segment}`;

    crumbs.push({
      href: current,
      label: ROUTE_LABELS[current] ?? titleFromSegment(segment),
    });
  }

  return crumbs;
}

function BreadcrumbLink({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) {
  const Comp = asChild ? Slot : "a";

  return <Comp className="rd-breadcrumb-link">{children}</Comp>;
}

function Separator() {
  return (
    <span className="rd-breadcrumb-separator" aria-hidden="true">
      /
    </span>
  );
}

export default function AppBreadcrumbs({
  className = "",
}: {
  className?: string;
}) {
  const pathname = usePathname();
  const cleanPathname = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  if (cleanPathname === "/" || cleanPathname === "/home") {
    return null;
  }

  const crumbs = buildCrumbs(cleanPathname);

  if (crumbs.length <= 1) {
    return null;
  }

  const first = crumbs[0];
  const current = crumbs[crumbs.length - 1];
  const middle = crumbs.slice(1, -1);

  return (
    <nav className={`rd-breadcrumbs ${className}`} aria-label="Breadcrumb">
      <ol className="rd-breadcrumb-list rd-breadcrumb-list--desktop">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;

          return (
            <li className="rd-breadcrumb-item" key={crumb.href}>
              {index > 0 ? <Separator /> : null}

              {isCurrent ? (
                <span className="rd-breadcrumb-current" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </li>
          );
        })}
      </ol>

      <ol className="rd-breadcrumb-list rd-breadcrumb-list--mobile">
        <li className="rd-breadcrumb-item">
          <BreadcrumbLink asChild>
            <Link href={first.href}>{first.label}</Link>
          </BreadcrumbLink>
        </li>

        {middle.length > 0 ? (
          <li className="rd-breadcrumb-item">
            <Separator />

            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                className="rd-breadcrumb-more"
                aria-label="Show breadcrumb pages"
              >
                …
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  sideOffset={8}
                  className="rd-breadcrumb-menu"
                >
                  {middle.map((crumb) => (
                    <DropdownMenu.Item
                      key={crumb.href}
                      className="rd-breadcrumb-menu-item"
                      asChild
                    >
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </li>
        ) : null}

        <li className="rd-breadcrumb-item">
          <Separator />
          <span className="rd-breadcrumb-current" aria-current="page">
            {current.label}
          </span>
        </li>
      </ol>
    </nav>
  );
}
