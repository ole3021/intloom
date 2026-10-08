import styles from "./hero.module.css";
import { Command } from "../../components/command.tsx";
import { IntentField } from "./intent-field/index.tsx";

export function Hero() {
  return (
    <section className={styles["field-hero"]} data-intent-surface>
      <div className={styles["field-hero-top"]}>
        <span className={styles.eyebrow}>
          <span className={styles["status-dot"]} /> SYSTEM / INTLOOM
        </span>
        <span className={styles.eyebrow}>HUMAN IN THE LOOP</span>
      </div>
      <div className={styles["field-hero-heading"]} data-reveal>
        <span className={styles["field-heading-label"]}>
          <span className={styles["pixel-sigil"]} aria-hidden="true" /> AN
          OPERATING FIELD FOR HUMAN INTENT
        </span>
        <h1>
          Give your intent
          <br />
          <span>
            a loom of <em>action.</em>
          </span>
        </h1>
        <p className={styles["field-hero-description"]}>
          Ideas become specifications. Decisions become structure.
          <br />
          Progress leaves evidence.
        </p>
        <div className={styles["hero-command"]}>
          <Command command="npx intloom start" />
          <p>Start your local project service.</p>
          <a href="#cli">
            Set up the CLI <span aria-hidden="true">↘</span>
          </a>
        </div>
      </div>
      <div className={styles["field-visual"]}>
        <IntentField />
        <div className={`${styles["field-axis"]} ${styles["axis-x"]}`} />
        <div className={`${styles["field-axis"]} ${styles["axis-y"]}`} />
      </div>
      <div className={styles["field-hero-bottom"]}>
        <span className={styles["hero-instrument-label"]}>
          <i /> FIG. 001 / LIVE INTENT FIELD
        </span>
        <span
          className={`${styles["hero-instrument-label"]} ${styles["hero-instrument-hint"]}`}
        >
          MOVE TO EXPLORE <span>↙</span>
        </span>
      </div>
    </section>
  );
}
