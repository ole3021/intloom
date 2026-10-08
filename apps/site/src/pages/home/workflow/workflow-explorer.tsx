import { useId, useState } from "react";
import { MotionContent } from "../../../motion/reveal.tsx";
import { StageVisual } from "./visuals/index.tsx";
import { stages } from "./stages.ts";
import styles from "./workflow.module.css";
export function WorkflowExplorer() {
  const id = useId();
  const [active, setActive] = useState(0);
  const stage = stages[active] ?? stages[0];
  return (
    <div className={styles["workflow-rows"]}>
      <div
        className={styles["stage-buttons"]}
        role="tablist"
        aria-label="Development stages"
      >
        {stages.map((item, index) => (
          <button
            key={item.title}
            id={`${id}-stage-${index}`}
            type="button"
            role="tab"
            aria-label={`${item.mark} ${item.title}`}
            aria-selected={active === index}
            aria-controls={`${id}-panel`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight" || event.key === "ArrowDown")
                next = (index + 1) % stages.length;
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
                next = (index + stages.length - 1) % stages.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = stages.length - 1;
              else return;
              event.preventDefault();
              setActive(next);
              document.getElementById(`${id}-stage-${next}`)?.focus();
            }}
          >
            <span className={styles["stage-mark"]}>{item.mark}</span>
            <span className={styles["stage-title"]}>{item.title}</span>
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        className={styles["stage-panel"]}
        role="tabpanel"
        aria-labelledby={`${id}-stage-${active}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Static tab panel content must be keyboard reachable after its tabs.
        tabIndex={0}
      >
        <MotionContent className={styles["stage-copy"]} key={stage.title}>
          <span className={styles.eyebrow}>
            {stage.mark} / {stage.title}
          </span>
          <h3>{stage.verb}</h3>
          <p>{stage.description}</p>
          <span className={styles["stage-artifact"]}>{stage.artifact}</span>
          <span className={styles["stage-state"]}>{stage.state}</span>
        </MotionContent>
        <StageVisual key={stage.id} stage={stage.id} />
        <code className={styles["stage-code"]}>{stage.code}</code>
      </div>
    </div>
  );
}
