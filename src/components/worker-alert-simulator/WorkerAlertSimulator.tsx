"use client";

import LockScreenPreview from "./LockScreenPreview";
import ChatMessagePreview from "./ChatMessagePreview";
import type { WorkerAlertDraft } from "@/lib/worker-alert/formatWorkerAlert";
import styles from "./WorkerAlertSimulator.module.css";

type Props = {
  job?: WorkerAlertDraft;
  className?: string;
};

export default function WorkerAlertSimulator({ job = {}, className = "" }: Props) {
  return (
    <section className={`${styles.simulator} ${className}`}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Worker Alert Simulator</p>

        <h3 className={styles.title}>Preview what staff will receive</h3>

        <p className={styles.note}>
          Preview only — final dispatch is handled by the 1stCall admin team.
        </p>
      </div>

      <div className={styles.previewGrid}>
        <LockScreenPreview job={job} />
        <ChatMessagePreview job={job} />
      </div>
    </section>
  );
}
