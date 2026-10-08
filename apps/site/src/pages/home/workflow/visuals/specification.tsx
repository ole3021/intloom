import styles from "./visuals.module.css";

export function SpecificationVisual() {
  return (
    <>
      <path
        className={styles["stage-outline"]}
        d="M48 42h144v45H94l-18 16V87H48z"
      />
      <text
        className={`${styles["stage-text"]} ${styles["intent-prompt"]}`}
        x="64"
        y="69"
      >
        I want to...
      </text>
      {[152, 164, 176].map((x, index) => (
        <circle
          key={x}
          className={[styles["intent-dot"], styles[`intent-dot-${index}`]]
            .filter(Boolean)
            .join(" ")}
          cx={x}
          cy="66"
          r="2"
        />
      ))}
      <path
        className={styles["stage-guide"]}
        d="M120 96v14M64 118h-8v75h8m112-75h8v75h-8"
      />
      {["GOAL", "RULES", "DONE"].map((label, index) => (
        <g
          key={label}
          className={[styles["brief-row"], styles[`brief-row-${index}`]]
            .filter(Boolean)
            .join(" ")}
        >
          <text
            className={`${styles["stage-text"]} ${styles["brief-label"]}`}
            x="68"
            y={134 + index * 25}
          >
            {label}
          </text>
          <path
            className={styles["stage-guide"]}
            d={`M115 ${131 + index * 25}h54`}
          />
          <path
            className={`${styles["brief-line"]} ${styles["stage-accent"]}`}
            pathLength="1"
            d={`M115 ${131 + index * 25}h${54 - index * 7}`}
          />
        </g>
      ))}
    </>
  );
}
