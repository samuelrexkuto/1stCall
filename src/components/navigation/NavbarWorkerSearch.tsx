"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlassIcon, Cross2Icon } from "@radix-ui/react-icons";
import { TextField } from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";

const OPERATIONS_MAP_ROUTE = "/";

function isOperationsMapRoute(pathname: string) {
  return (
    pathname === OPERATIONS_MAP_ROUTE ||
    pathname === "/" ||
    pathname === "/home" ||
    pathname === "/dashboard"
  );
}

export default function NavbarWorkerSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQuery = searchParams.get("workerName") ?? "";
  const [query, setQuery] = useState(currentQuery);

  useEffect(() => {
    setQuery(currentQuery);
  }, [currentQuery]);

  const targetPath = useMemo(() => {
    if (isOperationsMapRoute(pathname)) {
      return pathname;
    }

    return OPERATIONS_MAP_ROUTE;
  }, [pathname]);

  function commitSearch(nextValue?: string) {
    const value = typeof nextValue === "string" ? nextValue : query;
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = value.trim();

    if (trimmed) {
      params.set("workerName", trimmed);
      params.set("mapQuery", trimmed);
    } else {
      params.delete("workerName");
      params.delete("mapQuery");
    }

    const nextUrl = params.toString()
      ? `${targetPath}?${params.toString()}`
      : targetPath;

    router.push(nextUrl, {
      scroll: false,
    });
  }

  useEffect(() => {
    if (typeof window === "undefined" || !isOperationsMapRoute(pathname)) {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 900px)");
    if (!mediaQuery.matches) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const trimmed = query.trim();
      const currentWorkerName = searchParams.get("workerName") ?? "";
      const currentMapQuery = searchParams.get("mapQuery") ?? "";

      if (trimmed === currentWorkerName && trimmed === currentMapQuery) {
        return;
      }

      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set("workerName", trimmed);
        params.set("mapQuery", trimmed);
      } else {
        params.delete("workerName");
        params.delete("mapQuery");
      }

      const nextUrl = params.toString() ? `${targetPath}?${params.toString()}` : targetPath;
      router.replace(nextUrl, { scroll: false });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, searchParams, targetPath]);

  return (
    <form
      className="rd-navbar-worker-search-form"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        commitSearch();
      }}
    >
      <TextField.Root
        className="rd-navbar-worker-search"
        color="gray"
        radius="full"
        variant="surface"
        size="3"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search contractors or tradesmen"
        aria-label="Search contractors or tradesmen by name"
      >
        <TextField.Slot color="gray" px="3">
          <button
            type="submit"
            className="rd-navbar-worker-search-button"
            aria-label="Search contractors or tradesmen by name"
          >
            <MagnifyingGlassIcon className="rd-navbar-worker-search-icon" width="18" height="18" />
          </button>
        </TextField.Slot>

        {query ? (
          <TextField.Slot color="gray" px="2">
            <button
              type="button"
              className="rd-navbar-worker-search-button"
              aria-label="Clear contractor search"
              onClick={() => {
                setQuery("");
                commitSearch("");
              }}
            >
              <Cross2Icon className="rd-navbar-worker-search-icon" width="18" height="18" />
            </button>
          </TextField.Slot>
        ) : null}
      </TextField.Root>
    </form>
  );
}
