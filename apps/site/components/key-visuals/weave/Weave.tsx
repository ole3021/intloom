import styles from "./weave.module.css";
import { useId } from "react";

export function Weave({
  started = false,
  paused = false,
}: {
  started?: boolean;
  paused?: boolean;
}) {
  const gradientId = useId();
  return (
    <div
      className={styles.root}
      data-started={started}
      data-paused={paused}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 440"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <title>意图线交织成有序结构</title>
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            x2="1200"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#448aff" stopOpacity="0.05" />
            <stop offset="0.45" stopColor="#6da5ff" />
            <stop offset="0.7" stopColor="#b6d3ff" />
            <stop offset="1" stopColor="#448aff" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {Array.from({ length: 32 }, (_, i) => {
          const y = 30 + i * 12;
          return (
            <path
              key={`warp-${y}`}
              d={`M-50 ${y} C240 ${y - 120} 340 ${440 - y * 0.25} 600 ${90 + i * 8} S970 ${y - 60} 1250 ${y}`}
              stroke={`url(#${gradientId})`}
              strokeWidth={i === 16 ? 2.5 : 0.8}
              opacity={i === 16 ? 1 : 0.45}
              className={i === 16 ? styles.thread : undefined}
            />
          );
        })}
        {Array.from({ length: 22 }, (_, i) => {
          const x = 290 + i * 28;
          return (
            <path
              key={`weft-${x}`}
              d={`M${x} -40 C${x - 220} 160 ${x + 180} 270 ${x - 30} 500`}
              stroke="#637fa4"
              strokeWidth="0.7"
              opacity="0.3"
            />
          );
        })}
      </svg>
    </div>
  );
}
