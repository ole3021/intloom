import { MotionContent } from "../../../../motion/reveal.tsx";
import type { StageId } from "../stages.ts";
import styles from "./visuals.module.css";
import { SpecificationVisual } from "./specification.tsx";
import { SolutionVisual } from "./solution.tsx";
import { ImplementationVisual } from "./implementation.tsx";
import { ValidationVisual } from "./validation.tsx";
import { EvolutionVisual } from "./evolution.tsx";

const visuals = {
  specification: {
    caption: "CLARIFY THE INTENT",
    Graphic: SpecificationVisual,
  },
  solution: {
    caption: "REQUIREMENTS → DESIGN → PLAN",
    Graphic: SolutionVisual,
  },
  implementation: {
    caption: "GENERATE. TEST. COMMIT.",
    Graphic: ImplementationVisual,
  },
  validation: { caption: "CHECK AGAINST THE SPEC", Graphic: ValidationVisual },
  evolution: {
    caption: "FEEDBACK BECOMES THE NEXT VERSION",
    Graphic: EvolutionVisual,
  },
};
export function StageVisual({ stage }: { stage: StageId }) {
  const { caption, Graphic } = visuals[stage];
  return (
    <MotionContent
      className={styles["stage-diagram"]}
      data-stage={stage}
      aria-hidden="true"
    >
      <svg
        className={styles["stage-visual"]}
        viewBox="0 0 240 240"
        fill="none"
        aria-hidden="true"
      >
        <path
          className={styles["stage-registration"]}
          d="M24 42V24h18m156 0h18v18M24 198v18h18m156 0h18v-18"
        />
        <Graphic />
      </svg>
      <span className={styles["diagram-label"]}>{caption}</span>
    </MotionContent>
  );
}
