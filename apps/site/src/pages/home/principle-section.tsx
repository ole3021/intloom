import styles from "./principle-section.module.css";
import { SectionLabel } from "../../components/section-label.tsx";

export function PrincipleSection() {
  return (
    <section className={styles["field-principle"]} data-reveal>
      <SectionLabel number="01">THE OPERATING PRINCIPLE</SectionLabel>
      <div className={styles["field-statement"]}>
        <span className={styles["field-bracket"]} aria-hidden="true">
          [
        </span>
        <h2>
          Intelligence needs
          <br />
          <em>context.</em>
          <br />
          Execution needs
          <br />
          <em>direction.</em>
        </h2>
        <span className={styles["field-bracket"]} aria-hidden="true">
          ]
        </span>
      </div>
      <p>
        IntLoom connects the two. A workflow system that carries human intent
        through agents, code, and the decisions in between.
      </p>
    </section>
  );
}
