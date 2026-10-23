import { WarningAlt } from "@carbon/icons-react";
import styles from "./development-notice.module.css";

export function DevelopmentNotice() {
  return (
    <aside className={styles.notice} aria-label="Development notice">
      <WarningAlt className={styles.signal} size={16} aria-hidden="true" />
      <p>
        <strong>Under development.</strong> Not ready for production.
      </p>
    </aside>
  );
}
