"use client";

import type { BroadcastContextPreference } from "@/lib/broadcast-context";
import { AppDropdownMenu, DropdownMenu } from "@/components/ui/AppDropdownMenu";

export interface PromptActionMenuAction {
  id: string;
  label: string;
  description?: string;
  onSelect: () => void;
}

export function PromptActionMenu({
  actions,
  activeContext,
}: {
  actions: PromptActionMenuAction[];
  activeContext?: BroadcastContextPreference;
}) {
  return (
    <AppDropdownMenu
      align="start"
      side="top"
      className="prompt-action-dropdown"
      trigger={
        <button
          type="button"
          className="ai-compose-action ai-compose-icon-button dispatch-ai-composer__icon-button dispatch-ai-composer__icon-button--attach"
          aria-label="Open prompt actions"
          style={{
            border: "1px solid var(--composer-button-border, var(--rd-border))",
            background: activeContext === "onboarding" ? "var(--rd-primary)" : "var(--composer-button-bg, var(--rd-control-bg))",
            color: activeContext === "onboarding" ? "var(--rd-primary-text)" : "var(--rd-control-text)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 4V14M4 9H14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      }
    >
      {actions.map((action) => (
        <DropdownMenu.Item
          key={action.id}
          className="app-dropdown-item prompt-action-dropdown__item"
          onSelect={action.onSelect}
          data-active={action.id === "onboarding-context" && activeContext === "onboarding" ? "true" : undefined}
        >
          <span>
            <span className="prompt-action-dropdown__label">{action.label}</span>
            {action.description ? (
              <span className="prompt-action-dropdown__description">{action.description}</span>
            ) : null}
          </span>
        </DropdownMenu.Item>
      ))}
    </AppDropdownMenu>
  );
}
