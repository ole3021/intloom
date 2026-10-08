import * as z from "zod";
import { isDeepStrictEqual } from "node:util";
import type { SavedStage } from "./recovery/store.ts";
import { getLogger } from "@intloom/utils";
import type { BlueprintStage } from "../workflow/blueprint.ts";
import type { JsonValue, ReadonlyJsonValue } from "../shared/json.ts";
import type { StateAccess } from "../effector/state-access.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";

export interface StageStateBinding {
  readonly access: StateAccess<JsonValue>;
  bind(
    assertScope: () => void,
    allowAgentWait?: boolean,
  ): StateAccess<JsonValue>;
  snapshot(): ReadonlyJsonValue | undefined;
  checkpoint(): SavedStage;
  restore(saved: SavedStage): Promise<void>;
  release(): void;
}

export function createStageStateBinding(
  stage: BlueprintStage,
  assertActive: (write: boolean, allowAgentWait?: boolean) => void,
  onChange: () => void = () => {},
): StageStateBinding {
  let value: JsonValue | undefined;
  let inputValue: JsonValue | undefined;
  let queue: Promise<void> = Promise.resolve();
  const json = z.json();

  function copyJson(input: unknown): JsonValue {
    try {
      return structuredClone(json.parse(input));
    } catch (cause) {
      throw RUNTIME_ERRORS.wrap("STAGE_STATE_INVALID", cause);
    }
  }

  function enqueue(operation: () => Promise<void> | void): Promise<void> {
    const pending = queue.then(operation);
    // An operation failure does not poison the queue or trigger an automatic retry.
    queue = pending.catch(() => {});
    return pending;
  }

  async function write(
    mode: "create" | "update",
    input: JsonValue,
    assertScope: () => void,
    allowAgentWait: boolean,
  ) {
    assertScope();
    assertActive(true, allowAgentWait);
    // Copy inputs at call time so callers cannot modify them during queueing or asynchronous parsing.
    const snapshot = copyJson(input);
    await enqueue(async () => {
      assertScope();
      assertActive(true, allowAgentWait);
      if (mode === "create" && value !== undefined) {
        throw RUNTIME_ERRORS.create("STAGE_STATE_EXISTS");
      }
      if (mode === "update" && value === undefined) {
        throw RUNTIME_ERRORS.create("STAGE_STATE_NOT_FOUND");
      }
      let parsed: unknown;
      try {
        const result = await stage.stateSchema.safeParseAsync(snapshot);
        if (!result.success) throw result.error;
        parsed = result.data;
      } catch (cause) {
        throw RUNTIME_ERRORS.wrap("STAGE_STATE_INVALID", cause);
      }
      const next = copyJson(parsed);
      // Recheck after validation; stale access cannot write to a new Stage or a terminal Run.
      assertScope();
      assertActive(true, allowAgentWait);
      value = next;
      inputValue = snapshot;
      onChange();
      getLogger().debug(mode === "create" ? "state_created" : "state_updated");
    });
  }

  function snapshot(): ReadonlyJsonValue | undefined {
    return structuredClone(value);
  }

  function bind(
    assertScope: () => void,
    allowAgentWait = false,
  ): StateAccess<JsonValue> {
    return {
      get value() {
        assertScope();
        assertActive(false);
        return snapshot();
      },
      create: (input) => write("create", input, assertScope, allowAgentWait),
      update: (input) => write("update", input, assertScope, allowAgentWait),
      async clear() {
        assertScope();
        assertActive(true, allowAgentWait);
        await enqueue(() => {
          assertScope();
          assertActive(true, allowAgentWait);
          value = undefined;
          inputValue = undefined;
          onChange();
          getLogger().debug("state_cleared");
        });
      },
    };
  }

  return {
    access: bind(() => {}),
    bind,
    snapshot,
    checkpoint: () =>
      structuredClone({
        ...(inputValue === undefined ? {} : { input: inputValue }),
        ...(value === undefined ? {} : { value }),
      }),
    async restore(saved) {
      if (saved.input === undefined && saved.value === undefined) return;
      if (saved.input === undefined || saved.value === undefined)
        throw RUNTIME_ERRORS.create("STAGE_STATE_INVALID");
      const parsed = await stage.stateSchema.safeParseAsync(saved.input);
      if (!parsed.success || !isDeepStrictEqual(parsed.data, saved.value))
        throw RUNTIME_ERRORS.create("STAGE_STATE_INVALID", {
          message: "Saved Stage State no longer matches its Schema output.",
        });
      inputValue = copyJson(saved.input);
      value = copyJson(saved.value);
    },
    release() {
      value = undefined;
      inputValue = undefined;
    },
  };
}
