"use client";

import { useState } from "react";

export function SiteScoreExplanationAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <section
      style={{
        borderTop: "1px solid var(--rd-border)",
        paddingTop: "0.85rem",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          border: "none",
          background: "none",
          padding: 0,
          font: "inherit",
          fontWeight: 600,
          color: "var(--rd-text)",
          cursor: "pointer",
        }}
      >
        How this is calculated
      </button>

      {open ? (
        <div style={{ marginTop: "0.65rem", display: "grid", gap: "0.45rem", color: "var(--rd-text-muted)" }}>
          <p style={{ margin: 0 }}>
            Reliability = punctuality, attendance, shift completion, cancellation behaviour.
          </p>
          <p style={{ margin: 0 }}>
            Site Conduct = teamwork, communication, following instructions, professionalism.
          </p>
          <p style={{ margin: 0 }}>
            Work Quality = workmanship standard, snag frequency, rework required, task accuracy / finish.
          </p>
          <p style={{ margin: 0 }}>
            Site Score only uses jobs that were completed through the platform and included in the monthly score run.
          </p>
          <p style={{ margin: 0 }}>
            Fewer than 3 verified completed jobs shows Insufficient Verified Data, 3 to 5 shows a Provisional Score, and 6 or more shows an Established Score.
          </p>
          <p style={{ margin: 0 }}>
            Scores release monthly and are checked by admin before appearing on live worker profiles.
          </p>
        </div>
      ) : null}
    </section>
  );
}
