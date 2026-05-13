"use client";

import type { ReactNode } from "react";
import { Button } from "@radix-ui/themes";

export function WorkerGridCard({
  imageUrl,
  name,
  role,
  location,
  pill,
  matchPill,
  selectable = false,
  selected = false,
  onToggleSelected,
  onOpenProfile,
  footerAction,
  selectButtonBelow = false,
}: {
  imageUrl: string;
  name: string;
  role?: string | null;
  location?: string | null;
  pill?: string | null;
  matchPill?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
  onOpenProfile?: () => void;
  footerAction?: ReactNode;
  selectButtonBelow?: boolean;
}) {
  return (
    <article
      className={`rd-worker-grid-card${selected ? " rd-worker-grid-card-selected" : ""}`}
      role={onOpenProfile ? "button" : undefined}
      tabIndex={onOpenProfile ? 0 : undefined}
      onClick={onOpenProfile}
      onKeyDown={(event) => {
        if (onOpenProfile && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpenProfile();
        }
      }}
    >
      <div className="rd-worker-grid-card-image-wrap">
        <img src={imageUrl} alt={name} loading="lazy" className="rd-worker-grid-card-image" />
        <div className="rd-worker-grid-card-meta">
          {pill ? (
            <span className={`rd-worker-grid-card-pill${pill.toLowerCase() === "accepted" ? " rd-worker-grid-card-pill-accepted" : ""}`}>
              {pill}
            </span>
          ) : <span />}
          {matchPill ? <span className="rd-worker-grid-card-pill rd-worker-grid-card-pill-strong">{matchPill}</span> : null}
        </div>
        {selectable && !selectButtonBelow ? (
          <button
            type="button"
            className="rd-worker-grid-card-selector"
            aria-pressed={selected}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelected?.();
            }}
          >
            {selected ? "Selected" : "Select"}
          </button>
        ) : null}
      </div>
      <div className="rd-worker-grid-card-body">
        <strong className="rd-worker-grid-card-title">{name}</strong>
        {role ? <span className="rd-worker-grid-card-detail">{role}</span> : null}
        {location ? <span className="rd-worker-grid-card-detail">{location}</span> : null}
        {selectable && selectButtonBelow ? (
          <Button
            type="button"
            color="indigo"
            variant="soft"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelected?.();
            }}
          >
            {selected ? "Selected" : "Select"}
          </Button>
        ) : null}
        {footerAction ? (
          <div
            className="rd-worker-grid-card-footer"
            onClick={(event) => event.stopPropagation()}
          >
            {footerAction}
          </div>
        ) : null}
      </div>
    </article>
  );
}
