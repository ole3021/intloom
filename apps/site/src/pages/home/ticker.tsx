import styles from "./ticker.module.css";

export function Ticker() {
  return (
    <div
      className={styles["field-ticker"]}
      role="img"
      aria-label="Intent, structure, execution, evidence. Keep the context alive."
    >
      <div aria-hidden="true">
        {["first", "second", "third", "fourth"].map((copy) => (
          <span key={copy}>
            INTENT <b>↗</b> STRUCTURE <b>↗</b> EXECUTION <b>↗</b> EVIDENCE{" "}
            <i className={styles["ticker-mark"]} /> KEEP THE CONTEXT ALIVE{" "}
            <i className={styles["ticker-mark"]} />
          </span>
        ))}
      </div>
    </div>
  );
}
