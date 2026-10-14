import type { ExecutableCode } from "@intloom/workflow-sdk";
import {
  readImplementation,
  saveImplementation,
  assertImplementationBasis,
} from "../../src/implementation/state.ts";
import {
  validateChanges,
  runChecks,
  passed,
} from "../../src/implementation/checks.ts";
import { project, fail, repeatedCheckFailure } from "../../src/flow/shared.ts";
const check = (async (_input, access) => {
  const state = readImplementation(access);
  if (state.feedbacks.length >= 8)
    throw new Error("Implementation feedback budget exceeded");
  await assertImplementationBasis(access, state);
  const files = project(access);
  try {
    validateChanges(state, await files.snapshot());
    const checked = await runChecks(files, state.checks);
    state.checkResults = checked.results;
    if (!checked.results.every(passed)) {
      const content = `Project checks failed: ${JSON.stringify(checked.results)}`;
      const stalled = repeatedCheckFailure(state.feedbacks, content);
      state.feedbacks.push({
        source: "check",
        content,
      });
      await saveImplementation(access, state);
      if (stalled)
        fail(
          "Implementation repair repeated the same Check failure. Inspect the saved feedback before another execution.",
          "INTENT_REPAIR_STALLED",
        );
      return { outcome: "repair_required" };
    }
    state.checkedSnapshot = { ...checked.snapshot };
    await saveImplementation(access, state);
    return { outcome: "passed" };
  } catch (error) {
    access.signal.throwIfAborted();
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "INTENT_REPAIR_STALLED"
    )
      throw error;
    const content =
      error instanceof Error ? error.message : "Implementation checks failed.";
    const stalled = repeatedCheckFailure(state.feedbacks, content);
    state.feedbacks.push({
      source: "check",
      content,
    });
    delete state.checkedSnapshot;
    await saveImplementation(access, state);
    if (stalled)
      fail(
        "Implementation repair repeated the same Check failure. Inspect the saved feedback before another execution.",
        "INTENT_REPAIR_STALLED",
      );
    return { outcome: "repair_required" };
  }
}) satisfies ExecutableCode;
export default check;
