import { PublicWorkerOnboardingForm } from "@/components/onboarding/PublicWorkerOnboardingForm";
import styles from "./page.module.css";

export default function PublicOnboardingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>RD</div>
            <div className={styles.brandText}>
              <div>Recruited</div>
              <div>Dispatch</div>
            </div>
          </div>
        </div>

        <div className={styles.hero}>
          <p className={styles.eyebrow}>Public application</p>
          <h1 className={styles.title}>Join the Workforce Pool</h1>
          <p className={styles.subtitle}>
            Complete the form below to join the Recruited Dispatch workforce pool as a tradesman or contractor.
            Your details will be reviewed internally before approval, contract follow-up, and future dispatch opportunities.
          </p>
        </div>

        <PublicWorkerOnboardingForm />
      </div>
    </div>
  );
}
