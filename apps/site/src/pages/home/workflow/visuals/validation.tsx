import styles from "./visuals.module.css";

export function ValidationVisual() {
  return (
    <>
      <path
        className={styles["stage-outline"]}
        d="M48 40h89l20 20v125H48zM137 40v20h20"
      />
      <text
        className={`${styles["stage-text"]} ${styles["spec-document-title"]}`}
        x="61"
        y="64"
      >
        SPEC
      </text>
      {["GOAL", "RULES", "DONE"].map((label, index) => (
        <g
          key={label}
          className={[
            styles["verification-row"],
            styles[`verification-row-${index}`],
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <text
            className={`${styles["stage-text"]} ${styles["verification-label"]}`}
            x="62"
            y={86 + index * 31}
          >
            {label}
          </text>
          <path
            className={styles["stage-guide"]}
            d={`M62 ${94 + index * 31}h44`}
          />
          <path
            className={`${styles["verification-line"]} ${styles["stage-accent"]}`}
            pathLength="1"
            d={`M62 ${94 + index * 31}h${44 - index * 6}`}
          />
          <rect
            className={styles["stage-guide"]}
            x="124"
            y={80 + index * 31}
            width="19"
            height="17"
          />
          <path
            className={`${styles["verification-check"]} ${styles["stage-accent"]}`}
            pathLength="1"
            d={`m128 ${88 + index * 31} 4 4 7-9`}
          />
          <path
            className={`${styles["verification-evidence"]} ${styles["stage-accent"]}`}
            pathLength="1"
            d={`M158 ${88 + index * 31}h24`}
          />
          <circle
            className={`${styles["verification-evidence-dot"]} ${styles["stage-solid"]}`}
            cx="188"
            cy={88 + index * 31}
            r="3"
          />
          <path
            className={styles["stage-guide"]}
            d={`M182 ${98 + index * 31}h13`}
          />
        </g>
      ))}
      <text
        className={`${styles["stage-text"]} ${styles["verification-label"]}`}
        x="174"
        y="64"
      >
        PROOF
      </text>
      <path className={styles["stage-guide"]} d="M103 185v14h31m60-37v37h-12" />
      <path
        className={`${styles["verification-scan"]} ${styles["stage-accent"]}`}
        d="M40 72h124"
      />
      <g className={styles["verification-complete"]}>
        <rect
          className={styles["verification-badge"]}
          x="133"
          y="189"
          width="68"
          height="20"
        />
        <path className={styles["stage-accent"]} d="m140 199 3 3 5-6" />
        <text
          className={`${styles["stage-text"]} ${styles["verification-label"]}`}
          x="154"
          y="202"
        >
          VERIFIED
        </text>
      </g>
    </>
  );
}
