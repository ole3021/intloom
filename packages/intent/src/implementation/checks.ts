import { checkResultSchema } from "../../schemas/engineering.ts";
import { isDeepStrictEqual } from "node:util";
import type { ProjectAccess } from "@intloom/workflow-sdk";
import { fail, objects } from "../flow/shared.ts";
import type { ImplementationState } from "../../schemas/implementation-state.ts";
export function changeDiagnostics(
  state: ImplementationState,
  snapshot: Readonly<Record<string, string>>,
) {
  const declared = new Set(
    state.changes.flatMap((change) => change.paths.map((p) => p.path)),
  );
  const actual = new Set(
    [
      ...Object.keys(state.initialSnapshot ?? {}),
      ...Object.keys(snapshot),
    ].filter((path) => state.initialSnapshot?.[path] !== snapshot[path]),
  );
  const ids = new Set([
    ...objects(state.specification?.data).keys(),
    ...objects(state.solution?.data).keys(),
  ]);
  return {
    changedPaths: [...actual].sort(),
    missingPaths: [...actual].filter((path) => !declared.has(path)).sort(),
    unchangedPaths: [...declared].filter((path) => !actual.has(path)).sort(),
    validOriginRefs: [...ids].sort(),
    unknownOriginRefs: [
      ...new Set(
        state.changes
          .flatMap((change) => change.origin_refs)
          .filter((ref) => !ids.has(ref)),
      ),
    ].sort(),
    expectedFeedbackCount: state.feedbacks.length,
    feedbackUnprocessed:
      state.processedFeedbackCount !== state.feedbacks.length,
  };
}
export function validateChanges(
  state: ImplementationState,
  snapshot: Readonly<Record<string, string>>,
) {
  const issues = changeDiagnostics(state, snapshot);
  const messages = [
    ...issues.missingPaths.map((path) => `Unrecorded project change: ${path}`),
    ...issues.unchangedPaths.map(
      (path) => `Recorded path has no actual change: ${path}`,
    ),
    ...issues.unknownOriginRefs.map((ref) => `Unknown change origin: ${ref}`),
    ...(issues.feedbackUnprocessed
      ? [
          `Implementation feedback remains unprocessed. Use processedFeedbackCount=${issues.expectedFeedbackCount}.`,
        ]
      : []),
  ];
  if (messages.length) fail(messages.join("\n"));
}
export async function runChecks(
  project: ProjectAccess,
  checks: ImplementationState["checks"],
) {
  const before = await project.snapshot();
  const results = [];
  for (const check of checks)
    results.push(
      checkResultSchema.parse({
        id: check.id,
        purpose: check.purpose,
        ...(await project.run({
          command: check.command,
          args: check.args,
          ...(check.cwd ? { cwd: check.cwd } : {}),
          ...(check.timeoutMs ? { timeoutMs: check.timeoutMs } : {}),
        })),
      }),
    );
  const after = await project.snapshot();
  if (!isDeepStrictEqual(before, after))
    fail(
      `Checks changed source files: ${JSON.stringify([...new Set([...Object.keys(before), ...Object.keys(after)])].filter((path) => before[path] !== after[path]))}. Checks must restore temporary runtime data before exiting. Use isolated fixtures with cleanup; do not delete the implementation or change the approved check plan.`,
    );
  return { snapshot: after, results };
}
export const passed = (result: {
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
}) => result.exitCode === 0 && !result.timedOut && !result.truncated;
