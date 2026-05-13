"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { WorkerOverviewRow } from "@/lib/workers/types";

function verificationLabel(type: "platform_verified" | "external") {
  return type === "platform_verified" ? "Verified Platform Job" : "External Portfolio Item";
}

export function WorkerPortfolioSection({ worker }: { worker: WorkerOverviewRow }) {
  const images = useMemo(
    () =>
      worker.portfolio.flatMap((item) =>
        item.mediaUrls.map((url) => ({
          id: `${item.id}-${url}`,
          url,
          title: item.title,
          description: item.description,
          verificationType: item.verificationType,
        })),
      ),
    [worker.portfolio],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedImage = selectedIndex === null ? null : images[selectedIndex] ?? null;

  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Portfolio</h3>
        <p style={{ margin: "0.3rem 0 0", color: "var(--rd-text-muted)" }}>
          Compact evidence set for client review and shortlist decisions.
        </p>
      </div>
      {/* TODO: future off-platform portfolio images will be supplied through an email portfolio update window/button. */}

      {worker.portfolio.length === 0 ? (
        <div
          style={{
            padding: "0.95rem 1rem",
            borderRadius: 14,
            border: "1px dashed var(--rd-border-strong)",
            color: "var(--rd-text-muted)",
            background: "var(--rd-surface-soft)",
          }}
        >
          No portfolio items are attached yet.
        </div>
      ) : (
        <div className="rd-worker-grid">
          {images.length > 0 ? images.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              style={{
                display: "grid",
                gap: "0.45rem",
                padding: "0.45rem",
                borderRadius: 8,
                border: "1px solid var(--rd-border)",
                background: "var(--rd-bg-elevated)",
                textAlign: "left",
                color: "var(--rd-text)",
                cursor: "pointer",
              }}
            >
              <div style={{ position: "relative", aspectRatio: "16 / 11", overflow: "hidden", borderRadius: 8, background: "var(--rd-surface-soft)" }}>
                <img src={item.url} alt={item.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <span
                  style={{
                    position: "absolute",
                    top: "0.55rem",
                    left: "0.55rem",
                    borderRadius: 999,
                    padding: "0.2rem 0.55rem",
                    background: item.verificationType === "platform_verified" ? "#dcfce7" : "rgba(255,255,255,0.92)",
                    color: item.verificationType === "platform_verified" ? "#166534" : "#334155",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                  }}
                >
                  {verificationLabel(item.verificationType)}
                </span>
              </div>
              <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</strong>
            </button>
          )) : worker.portfolio.map((item) => (
            <article key={item.id} style={{ padding: "0.95rem 1rem", borderRadius: 8, border: "1px solid var(--rd-border)", background: "var(--rd-surface-soft)" }}>
              <strong>{item.title}</strong>
              <p style={{ margin: "0.35rem 0 0", color: "var(--rd-text-muted)" }}>{item.description || "No description provided."}</p>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={Boolean(selectedImage)}
        title={selectedImage?.title ?? "Portfolio image"}
        onClose={() => setSelectedIndex(null)}
      >
        {selectedImage ? (
          <div style={{ display: "grid", gap: "0.85rem" }}>
            <img
              src={selectedImage.url}
              alt={selectedImage.title}
              style={{
                width: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                borderRadius: 8,
                border: "1px solid var(--rd-border)",
                background: "var(--rd-surface-soft)",
              }}
            />
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button type="button" disabled={images.length <= 1} onClick={() => setSelectedIndex((current) => current === null ? 0 : (current === 0 ? images.length - 1 : current - 1))}>
                Previous
              </button>
              <button type="button" disabled={images.length <= 1} onClick={() => setSelectedIndex((current) => current === null ? 0 : (current + 1) % images.length)}>
                Next
              </button>
            </div>
            <p style={{ margin: 0, color: "var(--rd-text-muted)", lineHeight: 1.55 }}>
              {selectedImage.description || "No description provided."}
            </p>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
