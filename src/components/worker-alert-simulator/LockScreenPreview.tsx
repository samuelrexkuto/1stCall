import {
  formatWorkerAlert,
  type WorkerAlertDraft,
} from "@/lib/worker-alert/formatWorkerAlert";
import styles from "./WorkerAlertSimulator.module.css";

type Props = {
  job: WorkerAlertDraft;
};

export default function LockScreenPreview({ job }: Props) {
  const alert = formatWorkerAlert(job);

  return (
    <div className={styles.previewColumn}>
      <p className={styles.previewLabel}>Lock Screen Notification</p>

      <div className={styles.phoneFrame}>
        <div className={`${styles.phoneScreen} ${styles.lockScreen}`}>
          <div className={styles.notch} />

          <div className={styles.statusIcons}>
            <span>|||</span>
            <span>~</span>
            <span className={styles.battery}>▰</span>
          </div>

          <div className={styles.timeBlock}>
            <p className={styles.dateText}>Tue Apr 1</p>
            <p className={styles.timeText}>9:41</p>
          </div>

          <div className={styles.notificationWrap}>
            <div className={styles.notificationCard}>
              <div className={styles.notificationContent}>
                <div className={styles.appIcon}>1C</div>

                <div className={styles.notificationText}>
                  <div className={styles.notificationTop}>
                    <p className={styles.appName}>{alert.appName}</p>
                    <p className={styles.now}>now</p>
                  </div>

                  <p className={styles.alertTitle}>{alert.title}</p>

                  <p className={styles.shortBody}>{alert.shortBody}</p>

                  <p className={styles.shortMeta}>{alert.shortMeta}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={`${styles.lockButton} ${styles.lockButtonLeft}`}>L</div>

          <div className={`${styles.lockButton} ${styles.lockButtonRight}`}>O</div>

          <div className={styles.homeIndicatorLight} />
        </div>
      </div>
    </div>
  );
}
