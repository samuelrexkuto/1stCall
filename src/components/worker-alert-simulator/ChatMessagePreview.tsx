import {
  formatWorkerAlert,
  type WorkerAlertDraft,
} from "@/lib/worker-alert/formatWorkerAlert";
import styles from "./WorkerAlertSimulator.module.css";

type Props = {
  job: WorkerAlertDraft;
};

export default function ChatMessagePreview({ job }: Props) {
  const alert = formatWorkerAlert(job);

  return (
    <div className={styles.previewColumn}>
      <p className={styles.previewLabel}>Full Message Preview</p>

      <div className={styles.phoneFrame}>
        <div className={`${styles.phoneScreen} ${styles.chatScreen}`}>
          <div className={styles.notch} />

          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderInner}>
              <div className={styles.chatAvatar}>1C</div>

              <div>
                <p className={styles.chatName}>1stCall Dispatch</p>
                <p className={styles.chatStatus}>worker alert preview</p>
              </div>
            </div>
          </div>

          <div className={styles.chatBody}>
            <p className={styles.chatDate}>Today 9:41</p>

            <div className={styles.messageBubble}>
              {alert.fullMessage}

              <div className={styles.messageTime}>9:41 ✓✓</div>
            </div>
          </div>

          <div className={styles.homeIndicatorDark} />
        </div>
      </div>
    </div>
  );
}
