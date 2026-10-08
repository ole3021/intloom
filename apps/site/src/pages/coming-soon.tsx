import { useHead } from "@rspress/core/runtime";
import { Arrow } from "../components/brand.tsx";
import styles from "./coming-soon.module.css";
export function ComingSoon({ title }: { title: string }) {
  useHead({ title: `${title} — IntLoom` });
  return (
    <main id="main" tabIndex={-1} className={styles["coming-soon"]}>
      <section data-reveal>
        <span className={styles.eyebrow}>
          <span className={styles["status-dot"]} /> IN DEVELOPMENT
        </span>
        <h1>
          {title}
          <span>.</span>
        </h1>
        <p>In development. Check back soon.</p>
        <a href="/">
          Back to IntLoom <Arrow />
        </a>
      </section>
    </main>
  );
}
