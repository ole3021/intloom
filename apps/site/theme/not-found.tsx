import { useHead } from "@rspress/core/runtime";
import styles from "../src/pages/coming-soon.module.css";

export function NotFoundLayout() {
  useHead({ title: "Page not found — IntLoom" });
  return (
    <main id="main" tabIndex={-1} className={styles["coming-soon"]}>
      <section>
        <span className={styles.eyebrow}>404 / SIGNAL NOT FOUND</span>
        <h1>
          Page not found<span>.</span>
        </h1>
        <p>
          The page may have moved. Start from the homepage or search the docs.
        </p>
        <a href="/">
          Back to IntLoom <span aria-hidden="true">↗</span>
        </a>
      </section>
    </main>
  );
}
