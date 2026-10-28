import * as z from "zod";
import { loomInputSchema } from "@intloom/loom-sdk";
import type { BlueprintStage } from "@intloom/loom-sdk";
import type { JsonValue, ReadonlyJsonValue } from "@intloom/loom-sdk";
import type { StateAccess } from "@intloom/loom-sdk";
import { ERRORS } from "../errors.ts";
import type { RunState } from "./run-state.ts";
import type { SavedStage } from "./recovery/contracts.ts";
import {
  createStageStateBinding,
  type StageStateBinding,
} from "./stage-state-binding.ts";

/** Runtime-only management of the current Stage; business code receives only access. */
export interface StageStateController {
  readonly access: StateAccess<JsonValue> | undefined;
  /** Internal diagnostic snapshot; retains data after failure without adding it to RunView. */
  readonly value: ReadonlyJsonValue | undefined;
  settle(): Promise<void>;
  checkpoint(): SavedStage | undefined;
  restore(stage: BlueprintStage, saved: SavedStage): Promise<void>;
  enter(
    stage: BlueprintStage,
    assertScope?: () => void,
  ): Promise<StateAccess<JsonValue>>;
  /** Binds the current call and rechecks ownership before writes to prevent stale Steps from writing to the same Stage. */
  bind(
    assertScope: () => void,
    allowAgentWait?: boolean,
  ): StateAccess<JsonValue>;
  leave(): void;
}

/**
 * One container per Run, holding only the current Stage's business value; exited Stages are not cached.
 * The Run loop manages cursor transitions; Cursor must point to the target Stage before entry.
 */
export function createStageState(
  run: RunState,
  onChange: () => void = () => {},
  capability = false,
): StageStateController {
  let current: StageStateBinding | undefined;
  let ready = false;

  function leave(): void {
    current?.release();
    current = undefined;
    ready = false;
  }

  function makeBinding(stage: BlueprintStage) {
    const binding = createStageStateBinding(
      stage,
      (write, allowAgentWait) => {
        if (
          current !== binding ||
          run.cursor.stageName !== stage.stageName ||
          (run.status !== "running" &&
            (run.status !== "waiting" ||
              (write &&
                !(
                  allowAgentWait &&
                  run.pendingAgentCall &&
                  !run.pendingAction
                ))))
        )
          throw ERRORS.create("STAGE_STATE_INACTIVE");
      },
      onChange,
    );
    return binding;
  }

  return {
    get access() {
      return ready ? current?.access : undefined;
    },
    get value() {
      return current?.snapshot();
    },
    leave,
    async settle() {
      await current?.settle();
    },
    checkpoint() {
      return ready ? current?.checkpoint() : undefined;
    },
    async restore(stage, saved) {
      leave();
      const binding = makeBinding(stage);
      await binding.restore(saved);
      current = binding;
      ready = true;
    },
    bind(assertScope, allowAgentWait = false) {
      assertScope();
      if (!ready || !current) throw ERRORS.create("STAGE_STATE_INACTIVE");
      return current.bind(assertScope, allowAgentWait);
    },
    async enter(stage, assertScope = () => {}) {
      assertScope();
      if (
        run.status !== "running" ||
        run.cursor.stageName !== stage.stageName
      ) {
        throw ERRORS.create("STAGE_STATE_INACTIVE", {
          message: "Stage entry requires a running Run at the target Stage.",
        });
      }
      // Reentering the same named Stage creates a new binding; Step loops and interaction resumption must not call enter.
      leave();
      const binding = makeBinding(stage);
      current = binding;
      const context = Object.freeze({
        runId: run.id,
        loomName: run.loomName,
        stageName: stage.stageName,
        input: loomInputSchema.safeParse(run.input).data ?? {},
        ...(capability
          ? {
              invocationInput: z
                .json()
                .parse(JSON.parse(JSON.stringify(run.input))),
            }
          : {}),
      });
      try {
        const seed = await stage.initializeState(context);
        // create performs the single Stage Schema parse so transforms are not applied twice.
        await binding.bind(assertScope).create(seed);
        assertScope();
        if (
          current !== binding ||
          run.status !== "running" ||
          run.cursor.stageName !== stage.stageName
        ) {
          throw ERRORS.create("STAGE_STATE_INACTIVE");
        }
        ready = true;
        return binding.access;
      } catch (cause) {
        // Stale initialization cannot clear or fail a new Stage; Runtime manages Call ownership.
        if (current !== binding) {
          throw ERRORS.wrap("STAGE_STATE_INACTIVE", cause);
        }
        leave();
        if (ERRORS.is(cause) && cause.code === "STAGE_STATE_INACTIVE") {
          throw cause;
        }
        throw ERRORS.wrap("RUN_INITIALIZATION_FAILED", cause, {
          message: `Failed to initialize Stage ${stage.stageName}.`,
        });
      }
    },
  };
}
