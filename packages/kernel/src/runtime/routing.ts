import type { BlueprintStage, BlueprintStep } from "../workflow/blueprint.ts";

/** Transient resolution, not a third state record; RunState.status determines why execution halts. */
export type Resolution =
  | {
      readonly kind: "execute";
      readonly stage: BlueprintStage;
      readonly step: BlueprintStep;
    }
  | { readonly kind: "halt" };

/** Transient control instruction after synchronous advancement; enter_stage reinitializes even when reentering the same named Stage. */
export type Transition =
  | { readonly kind: "move_step" }
  | { readonly kind: "enter_stage"; readonly stage: BlueprintStage }
  | { readonly kind: "complete" };
