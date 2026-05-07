"use client";

import type { ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export function AppDropdownMenu({
  trigger,
  children,
  align = "end",
  side = "bottom",
  sideOffset = 8,
  collisionPadding = 12,
  className = "",
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  collisionPadding?: number;
  className?: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={`app-dropdown-content${className ? ` ${className}` : ""}`}
          align={align}
          side={side}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export { DropdownMenu };
