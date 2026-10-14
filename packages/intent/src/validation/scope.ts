import { isDeepStrictEqual } from "node:util";
import { authoring } from "../flow/draft.ts";
import { objects, references, json } from "../flow/shared.ts";
import { targets } from "./review.ts";
import type { ValidationState } from "../../schemas/validation-state.ts";
import type { SpecificationChange } from "../../schemas/specification-record.ts";

type Change = { target_ref: string; patch: SpecificationChange["patch"] };
type Implementation = {
  changes: readonly {
    paths: readonly { path: string }[];
    origin_refs: readonly string[];
  }[];
  initialSnapshot: Record<string, string>;
  fileSnapshot: Record<string, string>;
};

/** Record deltas define required coverage; history alone never proves current fulfillment. */
export function runScope(
  specification: unknown,
  solution: unknown,
  changes: readonly Change[],
  implementation: Implementation,
  firstRun: boolean,
) {
  const current = new Map([...objects(specification), ...objects(solution)]);
  const context = new Map(current);
  const owners = new Map<string, string>();
  // Parents precede children, so a nested interface/step belongs to its nearest report target.
  for (const target of [
    ...targets(specification, true),
    ...targets(solution, true),
  ])
    for (const id of objects(current.get(target.ref)).keys())
      owners.set(id, target.ref);
  const selected = new Set<string>();
  const reasons: Record<string, string[]> = {};
  function include(ref: string, reason: string) {
    ref = owners.get(ref) ?? ref;
    selected.add(ref);
    const list = reasons[ref] ?? [];
    reasons[ref] = list;
    if (!list.includes(reason)) list.push(reason);
  }
  for (const change of changes) {
    include(change.target_ref, "record_change");
    for (const [index, patch] of change.patch.entries()) {
      const value = "value" in patch ? patch.value : undefined;
      const entries = objects(value);
      for (const [id, item] of entries)
        if (!context.has(id)) context.set(id, item);
      if (patch.op === "test") continue;
      const previous = change.patch[index - 1];
      const old =
        previous?.op === "test" && previous.path === patch.path
          ? objects(previous.value)
          : new Map<string, Record<string, unknown>>();
      for (const id of new Set([...old.keys(), ...entries.keys()])) {
        if (
          !isDeepStrictEqual(authoring(old.get(id)), authoring(entries.get(id)))
        )
          include(id, "nested_record_change");
      }
    }
  }

  const changedPaths = Object.keys({
    ...implementation.initialSnapshot,
    ...implementation.fileSnapshot,
  }).filter(
    (path) =>
      implementation.initialSnapshot[path] !==
      implementation.fileSnapshot[path],
  );
  let full = firstRun;
  for (const path of changedPaths) {
    const refs = implementation.changes
      .filter((c) => c.paths.some((p) => p.path === path))
      .flatMap((c) => c.origin_refs);
    if (!refs.length || refs.some((ref) => !owners.has(ref))) full = true;
    for (const ref of refs) include(ref, "implementation_change");
    if (/(^|\/)(package\.json|[^/]*lock[^/]*|[^/]*config\.[^/]+)$/u.test(path))
      full = true;
  }
  for (const id of [...selected])
    if (id.startsWith("SREQ-"))
      for (const child of targets(context.get(id), true))
        include(child.ref, "contained_in_change");
  const seeds = new Set(selected);
  // One direct relationship expansion. Do not recursively turn every parent into all descendants.
  for (const [id, item] of context) {
    if (seeds.has(id)) {
      for (const ref of directReferences(item))
        if (current.has(ref)) include(ref, "related_to_change");
    } else if (
      directReferences(item, true).some((ref) =>
        seeds.has(owners.get(ref) ?? ref),
      )
    )
      include(id, "references_change");
  }
  if (full)
    for (const target of [...targets(specification), ...targets(solution)])
      include(target.ref, firstRun ? "initial_scope" : "broad_code_change");
  const scope: NonNullable<ValidationState["scope"]> = {
    specification: [],
    solution: [],
  };
  const scopeContext: Record<string, ReturnType<typeof json>> = {};
  for (const id of [...selected].sort()) {
    const item = context.get(id);
    if (!item) continue;
    const target = targets(item, true).find((t) => t.ref === id);
    if (!target) continue;
    scope[id.startsWith("S") ? "specification" : "solution"].push(target);
    scopeContext[id] = json({
      ...item,
      ...(!current.has(id) ? { removed: true } : {}),
    });
  }
  return {
    scope,
    scopeContext,
    scopeReasons: reasons,
    scopeMode: full ? ("full" as const) : ("run" as const),
    changedPaths,
  };
}

function directReferences(item: Record<string, unknown>, reverse = false) {
  const { modules: _modules, acceptances: _acceptances, ...own } = item;
  if (reverse) delete own.parent_ref;
  return references(own);
}
