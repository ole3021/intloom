import styles from "./studio-section.module.css";
import { Mark } from "../../components/brand.tsx";
import { SectionLabel } from "../../components/section-label.tsx";

export function StudioSection() {
  return (
    <section id="studio" className={styles["field-studio"]} data-reveal>
      <div>
        <SectionLabel number="04">INTLOOM STUDIO</SectionLabel>
        <h2>
          A new way
          <br />
          <span>into the loom.</span>
        </h2>
        <p>
          A visual companion to IntLoom. Studio is planned, with design and
          implementation still to come.
        </p>
        <span className={styles["studio-status"]}>
          <span className={styles["status-dot"]} /> COMING SOON / STAY TUNED
        </span>
      </div>
      <div
        className={styles["studio-preview"]}
        role="img"
        aria-label="IntLoom Studio, coming soon"
      >
        <span className={styles.eyebrow}>INTLOOM / STUDIO</span>
        <Mark className={styles["loom-mark"]} />
        <span className={styles["studio-signal"]} aria-hidden="true" />
        <span className={styles.eyebrow}>A NEW VIEW IS ON THE HORIZON.</span>
      </div>
    </section>
  );
}
