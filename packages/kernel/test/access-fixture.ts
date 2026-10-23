import { bindAgentToolAccess } from "../src/access/code.ts";
import type {
  JsonValue,
  CodeExecutionAccess,
  ProjectAccess,
} from "@intloom/loom-sdk";
import { runtimeFixture } from "./runtime-fixture.ts";

export function executionAccess(
  initial: JsonValue = { value: 0 },
  project?: ProjectAccess,
) {
  let value: JsonValue | undefined = initial;
  const controller = new AbortController();
  const storage = runtimeFixture().storage;
  const state = {
    get value() {
      return structuredClone(value);
    },
    async create(next: JsonValue) {
      value = structuredClone(next);
    },
    async update(next: JsonValue) {
      value = structuredClone(next);
    },
    async clear() {
      value = undefined;
    },
  };
  const check = () => controller.signal.throwIfAborted();
  const agent = bindAgentToolAccess(
    {
      scope: {
        runId: "fixture",
        callId: "fixture",
        signal: controller.signal,
        assertCurrent: check,
        beginUse() {
          check();
          return { assertCurrent: check, finish() {} };
        },
      },
      bindState: (assertCurrent) => ({
        get value() {
          assertCurrent();
          return state.value;
        },
        async create(next) {
          assertCurrent();
          await state.create(next);
        },
        async update(next) {
          assertCurrent();
          await state.update(next);
        },
        async clear() {
          assertCurrent();
          await state.clear();
        },
      }),
      storage,
      project,
    },
    check,
  );
  const code: CodeExecutionAccess<JsonValue> = {
    ...agent,
    storage,
    interaction: {
      async askQuestions() {
        throw new Error("Unexpected interaction");
      },
      async confirm() {
        throw new Error("Unexpected interaction");
      },
    },
  };
  return { agent, code, controller, storage, state };
}
