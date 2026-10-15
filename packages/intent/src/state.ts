import type * as z from "zod";
import type { StageAccess } from "./access.ts";
import type { BaseState } from "./schema/common.ts";
import { fail } from "./errors.ts";
import { json } from "./json.ts";
export function read<S extends BaseState>(
  access: StageAccess,
  schema: z.ZodType<S>,
): S {
  return schema.parse(access.state.value);
}
export async function save<S extends BaseState>(
  access: StageAccess,
  state: S,
  bump = true,
) {
  if (bump) state.revision++;
  await access.state.update(json(state));
}
export function assertRevision(
  state: BaseState,
  revision: number,
  tasks: string[],
) {
  if (revision !== state.revision)
    fail(
      "Context changed; read the current context before submitting.",
      "STALE_INTENT_DRAFT",
    );
  if (!tasks.includes(state.task))
    fail(`This operation is unavailable during ${state.task}.`);
}
export function toolResult(state: BaseState, error?: unknown) {
  return error
    ? {
        saved: false,
        revision: state.revision,
        issues: [error instanceof Error ? error.message : String(error)],
      }
    : { saved: true, revision: state.revision };
}
export function unique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) fail(`Duplicate ${label}.`);
}
export function contains(
  available: readonly string[],
  requested: readonly string[],
  label: string,
) {
  unique(requested, label);
  for (const ref of requested)
    if (!available.includes(ref)) fail(`Unknown ${label}: ${ref}`);
}
