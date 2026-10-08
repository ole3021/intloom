import styles from "./visuals.module.css";
const solutionArtifacts = [
  { label: "ARCH", icon: "M9 7h6v5H9zm3 5v4m-7 0h14m-14 0v4m7-4v4m7-4v4" },
  { label: "API", icon: "m8 7-4 6 4 6m8-12 4 6-4 6m-7-6h6" },
  {
    label: "PLAN",
    icon: "M5 7h2v2H5zm5 1h9M5 13h2v2H5zm5 1h9M5 19h2v2H5zm5 1h9",
  },
];

export function SolutionVisual() {
  return (
    <>
      <path className={styles["stage-guide"]} d="M120 66v8H72v10m48-10h48v10" />
      <path
        className={`${styles["solution-signal"]} ${styles["stage-accent"]}`}
        d="M120 66v8H72v10m48-10h48v10"
      />
      <path
        className={styles["stage-outline"]}
        d="m120 38 19 14-19 14-19-14z"
      />
      <circle
        className={`${styles["solution-source"]} ${styles["stage-solid"]}`}
        cx="120"
        cy="52"
        r="3"
      />
      <text
        className={`${styles["stage-text"]} ${styles["solution-label"]}`}
        x="148"
        y="55"
      >
        SPEC
      </text>
      {[
        { x: 36, name: "App" },
        { x: 132, name: "Service" },
      ].map(({ x, name }, index) => (
        <g
          key={name}
          className={[
            styles["solution-branch"],
            styles[`solution-branch-${index}`],
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <rect
            className={styles["solution-branch-box"]}
            x={x}
            y="84"
            width="72"
            height="42"
          />
          <text
            className={`${styles["stage-text"]} ${styles["solution-name"]}`}
            x={x + 8}
            y="99"
          >
            {name}
          </text>
          <path
            className={styles["stage-guide"]}
            d={`M${x + 8} 110h56m-56 8h56`}
          />
          <path
            className={`${styles["solution-metric"]} ${styles["stage-accent"]}`}
            pathLength="1"
            d={`M${x + 8} 110h42m-42 8h50`}
          />
          <path
            className={styles["stage-guide"]}
            d={`M${x + 36} 126v20h-28v20m28-20v20m0-20h28v20`}
          />
          <path
            className={`${styles["solution-decision"]} ${styles["stage-accent"]}`}
            pathLength="1"
            d={`M${x + 36} 126v20h-28v20m28-20v20m0-20h28v20`}
          />
          <circle
            className={styles["stage-solid"]}
            cx={x + 36}
            cy="146"
            r="2"
          />
          {solutionArtifacts.map(({ label, icon }, artifactIndex) => (
            <g
              key={label}
              transform={`translate(${x - 4 + artifactIndex * 28} 166)`}
            >
              <g
                className={[
                  styles["solution-node"],
                  styles[`solution-node-${artifactIndex}`],
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <rect
                  className={`${styles["solution-artifact-box"]} ${styles["stage-outline"]}`}
                  width="24"
                  height="40"
                />
                <path className={styles["stage-accent"]} d={icon} />
                <text
                  className={`${styles["stage-text"]} ${styles["solution-artifact-label"]}`}
                  x="12"
                  y="33"
                  textAnchor="middle"
                >
                  {label}
                </text>
              </g>
            </g>
          ))}
        </g>
      ))}
    </>
  );
}
