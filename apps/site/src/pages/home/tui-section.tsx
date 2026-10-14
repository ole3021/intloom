import { useEffect, useRef, useState } from "react";
import { Arrow } from "../../components/brand.tsx";
import { SectionLabel } from "../../components/section-label.tsx";
import { useMotionControl } from "../../motion/motion-provider.tsx";
import styles from "./tui-section.module.css";

const progressStages = ["INTENT", "SPEC", "BUILD", "VERIFY"];
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

export function TuiSection() {
  return (
    <section id="tui" className={styles["field-tui"]} data-reveal>
      <SectionLabel number="04">INTLOOM TUI</SectionLabel>
      <div className={styles.grid}>
        <div className={styles.introduction}>
          <span className={styles.badge}>BETA / IN DEVELOPMENT</span>
          <h2>
            Your workflow.
            <br />
            <span className={styles["heading-accent"]}>Within reach.</span>
          </h2>
          <p>
            A terminal workspace for your current project. Explore workflows,
            follow runs, and inspect results without leaving the terminal.
            IntLoom TUI is in beta and actively being developed.
          </p>
          <a href="/guide/start/tui">
            Explore the TUI <Arrow direction="right" />
          </a>
        </div>
        <figure
          className={styles.preview}
          aria-label="IntLoom TUI development preview"
        >
          <div className={styles["preview-title"]}>
            <span>INTLOOM / TUI</span>
            <span className={styles["preview-beta"]}>BETA</span>
          </div>
          <div className={styles.workspace}>
            <span className={styles.eyebrow}>CURRENT PROJECT</span>
            <div className={styles["workspace-tabs"]} aria-hidden="true">
              <span>Workflows</span>
              <span>Runs</span>
              <span>Results</span>
            </div>
            <div className={styles["workflow-row"]}>
              <ChevronRight size={16} aria-hidden="true" />
              <div>
                <strong>Intent Workflow</strong>
                <span>From requirements to retained results.</span>
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
