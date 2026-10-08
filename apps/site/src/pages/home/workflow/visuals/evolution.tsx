import styles from "./visuals.module.css";

export function EvolutionVisual() {
  return (
    <>
      <path className={styles["stage-guide"]} d="M52 61h136M120 66v14" />
      <path
        className={`${styles["evolution-track"]} ${styles["stage-accent"]}`}
        d="M52 61h136"
      />
      {[52, 120, 188].map((x, index) => (
        <g
          key={x}
          className={[styles["version-node"], styles[`version-node-${index}`]]
            .filter(Boolean)
            .join(" ")}
        >
          <circle className={styles["version-point"]} cx={x} cy="61" r="5" />
          <text
            className={`${styles["stage-text"]} ${styles["version-label"]}`}
            x={x}
            y="46"
            textAnchor="middle"
          >
            v{index + 1}
          </text>
        </g>
      ))}
      <circle
        className={`${styles["evolution-packet"]} ${styles["stage-solid"]}`}
        cx="52"
        cy="61"
        r="2.5"
      />
      <path
        className={styles["stage-guide"]}
        d="M40 101h-7v104h160v-7M41 94v103h160"
      />
      <rect
        className={`${styles["stage-outline"]} ${styles["editor-window"]}`}
        x="48"
        y="87"
        width="160"
        height="104"
      />
      <path className={styles["stage-guide"]} d="M48 111h160" />
      <text
        className={`${styles["stage-text"]} ${styles["editor-filename"]}`}
        x="61"
        y="102"
      >
        project.ts
      </text>
      <text
        className={`${styles["stage-text"]} ${styles["version-diff-count"]}`}
        x="167"
        y="102"
      >
        +2 −1
      </text>
      <g className={styles["evolution-removed"]}>
        <text
          className={`${styles["stage-text"]} ${styles["diff-removed"]}`}
          x="62"
          y="131"
        >
          − draft();
        </text>
        <path
          className={`${styles["evolution-strike"]} ${styles["stage-outline"]}`}
          pathLength="1"
          d="M73 128h51"
        />
      </g>
      {["+ refine();", "+ verify();"].map((line, index) => (
        <g
          key={line}
          className={[
            styles["evolution-added"],
            styles[`evolution-added-${index}`],
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <rect
            className={styles["diff-highlight"]}
            x="57"
            y={140 + index * 22}
            width="141"
            height="17"
          />
          <text
            className={`${styles["stage-text"]} ${styles["diff-added"]}`}
            x="62"
            y={152 + index * 22}
          >
            {line}
          </text>
        </g>
      ))}
    </>
  );
}
