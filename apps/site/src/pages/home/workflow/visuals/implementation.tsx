import type { CSSProperties } from "react";
import styles from "./visuals.module.css";
const codeLines = [
  "async function run() {",
  "  const spec = read();",
  "  const code = build(spec);",
  "  await test(code);",
  "  return commit(code);",
  "}",
];

export function ImplementationVisual() {
  return (
    <>
      <rect
        className={`${styles["stage-outline"]} ${styles["editor-window"]}`}
        x="28"
        y="43"
        width="184"
        height="154"
      />
      <path className={styles["stage-guide"]} d="M28 67h184M54 78v106" />
      <text
        className={`${styles["stage-text"]} ${styles["code-file-icon"]}`}
        x="38"
        y="58"
      >
        {"</>"}
      </text>
      <text
        className={`${styles["stage-text"]} ${styles["editor-filename"]}`}
        x="67"
        y="58"
      >
        intent.ts
      </text>
      <circle className={styles["stage-solid"]} cx="200" cy="55" r="2" />
      <svg
        x="34"
        y="73"
        width="172"
        height="116"
        viewBox="34 73 172 116"
        overflow="hidden"
        aria-hidden="true"
      >
        {codeLines.map((line, index) => (
          <g
            key={line}
            className={styles["code-row"]}
            style={
              {
                "--line-delay": `${index * 0.6 - 3.6}s`,
                "--line-width": `${line.length * 5.1}px`,
              } as CSSProperties
            }
          >
            <rect
              className={styles["code-active-line"]}
              x="59"
              y={77 + index * 18}
              width="146"
              height="16"
            />
            <text
              className={`${styles["stage-text"]} ${styles["code-line-number"]}`}
              x="38"
              y={88 + index * 18}
            >
              {index + 1}
            </text>
            <text
              className={[
                styles["stage-text"],
                styles["code-type"],
                styles[`code-syntax-${index % 3}`],
              ]
                .filter(Boolean)
                .join(" ")}
              x="62"
              y={88 + index * 18}
              xmlSpace="preserve"
              textLength={line.length * 5.1}
              lengthAdjust="spacingAndGlyphs"
            >
              {line}
            </text>
            <rect
              className={styles["code-caret"]}
              x="62"
              y={79 + index * 18}
              width="2"
              height="11"
            />
          </g>
        ))}
      </svg>
    </>
  );
}
