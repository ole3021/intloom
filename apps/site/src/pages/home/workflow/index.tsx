import styles from "./workflow.module.css";
import { SectionLabel } from "../../../components/section-label.tsx";
import { Arrow } from "../../../components/brand.tsx";
import { WorkflowExplorer } from "./workflow-explorer.tsx";

export function WorkflowSection() {
  return (
    <section id="workflow" className={styles["field-workflow"]} data-reveal>
      <SectionLabel number="02">WORKFLOW EXPLORER</SectionLabel>
      <div className={styles["section-heading"]}>
        <h2>Trace the signal.</h2>
        <span className={styles.eyebrow}>
          SELECT A STAGE TO INSPECT <Arrow direction="down-right" />
        </span>
      </div>
      <WorkflowExplorer />
    </section>
  );
}
