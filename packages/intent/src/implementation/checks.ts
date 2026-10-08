import { checkResultSchema } from "../../schemas/engineering.ts";
import { isDeepStrictEqual } from "node:util";
import type { ProjectAccess } from "@intloom/workflow-sdk";
import { fail, objects } from "../flow/shared.ts";
import type { ImplementationState } from "../../schemas/implementation-state.ts";
export function validateChanges(
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
  for (const path of actual)
    if (!declared.has(path)) fail(`Unrecorded project change: ${path}`);
  for (const path of declared)
    if (!actual.has(path)) fail(`Recorded path has no actual change: ${path}`);
  const ids = new Set([
    ...objects(state.specification?.data).keys(),
    ...objects(state.solution?.data).keys(),
  ]);
  for (const change of state.changes)
    for (const ref of change.origin_refs)
      if (!ids.has(ref)) fail(`Unknown change origin: ${ref}`);
  if (state.processedFeedbackCount !== state.feedbacks.length)
    fail("Implementation feedback remains unprocessed.");
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
    fail("Checks changed source files. Inspect changes and run checks again.");
  return { snapshot: after, results };
}
export const passed = (result: {
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
}) => result.exitCode === 0 && !result.timedOut && !result.truncated;
