import { useEffect, useRef, useState } from "react";

import { SectionLabel } from "./section-label.tsx";
import { useMotionControl } from "../motion/motion-provider.tsx";
import styles from "./client-preview.module.css";

const progressStages = ["DRAFT", "SAVE", "REVIEW", "DELIVER"];
const segmentPath = "M10 0H17L7 14H0Z";

function DevelopmentProgress() {
  const { paused } = useMotionControl();
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(24);
  const [active, setActive] = useState(0);
  const runningStart = Math.round(count / 2);
  const runningEnd = Math.round((count * 3) / 4);
  const runningCount = runningEnd - runningStart;

  useEffect(() => {
    const track = ref.current;
    if (!track) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 0) return;
      const gap = Number.parseFloat(getComputedStyle(track).columnGap);
      setCount(
        Math.max(4, Math.floor((entry.contentRect.width + gap) / (17 + gap))),
      );
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      if (!document.hidden) setActive((slot) => (slot + 1) % runningCount);
    }, 300);
    return () => clearInterval(timer);
  }, [paused, runningCount]);

  const columns = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` };
  return (
    <div className={styles["stage-progress"]} aria-hidden="true">
      <div ref={ref} className={styles["progress-track"]} style={columns}>
        {Array.from({ length: count }, (_, slot) => (
          <svg
            // biome-ignore lint/suspicious/noArrayIndexKey: Segments have no independent state or ordering.
            key={slot}
            className={`${styles["progress-segment"]} ${slot < runningStart ? styles.complete : ""}`}
            viewBox="0 0 17 14"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={segmentPath} />
            {slot === runningStart + (active % runningCount) && (
              <path className={styles["progress-signal"]} d={segmentPath} />
            )}
          </svg>
        ))}
      </div>
      <div className={styles["progress-labels"]} style={columns}>
        {progressStages.map((stage, index) => (
          <span
            key={stage}
            className={index === 2 ? styles["running-label"] : undefined}
            style={{
              gridColumn: `${Math.round((index * count) / 4) + 1} / ${Math.round(((index + 1) * count) / 4) + 1}`,
            }}
          >
            {stage}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ClientPreview() {
  return (
    <section id="client" className="module">
      <SectionLabel number="05">INTLOOM CLIENT</SectionLabel>
      <div className="split">
        <div className={styles.introduction}>
          <span className={styles.badge}>IN DEVELOPMENT</span>
          <h2>
            IntLoom <em>Client.</em>
          </h2>
          <p>
            A preview of the workspace for browsing Looms, following a run, and
            inspecting its results.
          </p>
        </div>
        <figure
          className={styles.preview}
          aria-label="IntLoom Client development preview"
        >
          <div className={styles["preview-title"]}>
            <span>INTLOOM / CLIENT</span>
            <span className={styles["preview-beta"]}>PREVIEW</span>
          </div>
          <div className={styles.workspace}>
            <span className={styles.eyebrow}>CURRENT PROJECT</span>
            <div className={styles["workspace-tabs"]} aria-hidden="true">
              <span>Looms</span>
              <span>Runs</span>
              <span>Results</span>
            </div>
            <div className={styles["workflow-row"]}>
              <ChevronRight size={16} aria-hidden="true" />
              <div>
                <strong>Reviewed report</strong>
                <span>From a saved draft to an explicit review.</span>
              </div>
            </div>
            <div className={styles.activity}>
              <div className={styles["activity-label"]}>
                <span>DEVELOPMENT IN PROGRESS</span>
                <span aria-hidden="true">···</span>
              </div>
              <DevelopmentProgress />
              <span className={styles["preview-note"]}>
                Taking shape, one iteration at a time.
              </span>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
import { ChevronRight } from "@carbon/icons-react";
