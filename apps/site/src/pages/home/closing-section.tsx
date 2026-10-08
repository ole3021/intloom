import styles from "./closing-section.module.css";
import { Arrow } from "../../components/brand.tsx";

export function ClosingSection() {
  return (
    <section className={styles["field-end"]} data-reveal>
      <span className={styles.eyebrow}>THIS SYSTEM IS STILL EVOLVING.</span>
      <h2>
        Stay in <span>the loom.</span>
      </h2>
      <div>
        <a href="/examples">
          CHECK REAL EXAMPLE <Arrow />
        </a>
        <a href="/guide/introduction">
          READ THE DOCUMENTATION <Arrow />
        </a>
      </div>
    </section>
  );
}
