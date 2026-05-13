"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { IconButton } from "@radix-ui/themes";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="rd-modal-overlay"
      onClick={onClose}
    >
      <div className="rd-modal-backdrop" />
      <div
        className="rd-modal-panel"
        ref={panelRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rd-modal-header">
          <h2 className="rd-modal-title">{title}</h2>
          <IconButton
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rd-modal-close"
            variant="soft"
            radius="full"
            size="2"
          >
            <Cross2Icon />
          </IconButton>
        </div>
        <div className="rd-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
