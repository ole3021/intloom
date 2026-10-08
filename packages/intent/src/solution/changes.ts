import { isDeepStrictEqual } from "node:util";
import { solutionArtifactSchema } from "../../schemas/solution-artifact.ts";
import {
  emptySolution,
  type SolutionState,
} from "../../schemas/solution-state.ts";
import { fail, objects, references } from "../flow/shared.ts";

export function reviewSolution(state: SolutionState) {
  if (!state.specification || state.baseline === undefined)
    fail("Solution must be initialized.");
  const baseline = state.baseline
    ? solutionArtifactSchema.parse(state.baseline.data)
    : emptySolution();
  const root = structuredClone(baseline);
  const before = objects(baseline),
    upstream = objects(state.specification.data);
  const origins = new Set<string>(),
    changed = new Set<string>();
  function containing(item: Record<string, unknown>): unknown[] {
    const id = String(item.id);
    const collections: Record<string, unknown[]> = {
      OAPP: root.structure.apps,
      OPKG: root.structure.packages,
      ORES: root.structure.resources,
      OREL: root.structure.relations,
      OSCN: root.scenarios,
      OCON: root.concepts,
      ODEC: root.decisions,
      ORISK: root.risks,
      ODIAG: root.diagrams,
    };
    if (id.startsWith("OMOD-")) {
      const parent = objects(root).get(String(item.parent_ref));
      if (!parent || !Array.isArray(parent.modules))
        fail("Module parent does not exist.");
      return parent.modules;
    }
    const collection = collections[id.split("-")[0] ?? ""];
    if (!collection) fail(`Unsupported Solution target ${id}`);
    return collection;
  }
  for (const change of state.changes) {
    let target = objects(root).get(change.target_ref);
    const original = structuredClone(target);
    for (const patch of change.patch) {
      if (patch.path === "") {
        if (patch.op !== "add" || target || before.has(change.target_ref))
          fail("Solution object roots can only be added with new identities.");
        if (
          !patch.value ||
          typeof patch.value !== "object" ||
          Array.isArray(patch.value)
        )
          fail("New Solution object must be an object.");
        target = structuredClone(patch.value) as Record<string, unknown>;
        if (target.id !== change.target_ref)
          fail("Object identity must match target_ref.");
        if (Array.isArray(target.record_refs) && target.record_refs.length)
          fail("New record_refs must be empty.");
        containing(target).push(target);
      } else {
        if (!target) fail("Unknown Solution target.");
        if (/~(?![01])/u.test(patch.path)) fail("Invalid JSON pointer.");
        const parts = patch.path
          .slice(1)
          .split("/")
          .map((p) => p.replaceAll("~1", "/").replaceAll("~0", "~"));
        if (
          parts.some((p) =>
            ["__proto__", "constructor", "prototype"].includes(p),
          ) ||
          (patch.op !== "test" &&
            parts.some((p) => ["id", "record_refs"].includes(p)))
        )
          fail("Identity and provenance are managed by Code.");
        let parent: Record<string, unknown> | unknown[] = target;
        for (const part of parts.slice(0, -1)) {
          const next: unknown = Reflect.get(parent, part);
          if (!next || typeof next !== "object") fail("Invalid patch path.");
          parent = next as Record<string, unknown>;
        }
        const key = parts.at(-1);
        if (key === undefined) fail("Missing patch field.");
        const exists = Object.hasOwn(parent, key);
        if (patch.op === "test") {
          if (
            !exists ||
            !isDeepStrictEqual(Reflect.get(parent, key), patch.value)
          )
            fail("Solution patch test failed.");
        } else if (Array.isArray(parent)) {
          const index = key === "-" ? parent.length : Number(key);
          if (
            !Number.isInteger(index) ||
            index < 0 ||
            index > parent.length ||
            (key !== "-" && String(index) !== key)
          )
            fail("Invalid array index.");
          if (patch.op === "add")
            parent.splice(index, 0, structuredClone(patch.value));
          else {
            if (index === parent.length) fail("Missing array element.");
            if (patch.op === "remove") parent.splice(index, 1);
            else parent[index] = structuredClone(patch.value);
          }
        } else if (patch.op === "remove") {
          if (!exists) fail("Missing field.");
          Reflect.deleteProperty(parent, key);
        } else {
          if (
            (patch.op === "replace" && !exists) ||
            (patch.op === "add" && exists)
          )
            fail("Invalid patch field operation.");
          Reflect.set(parent, key, structuredClone(patch.value));
        }
      }
    }
    if (isDeepStrictEqual(original, target))
      fail("Solution change has no effect.");
    changed.add(change.target_ref);
    if (before.has(change.target_ref)) origins.add(change.target_ref);
    for (const ref of [...references(original), ...references(target)])
      if (before.has(ref) || upstream.has(ref)) origins.add(ref);
  }
  const after = objects(root);
  for (const [id, old] of before) {
    const next = after.get(id);
    if (/^(OAPP|OPKG|OMOD)-/.test(id) && !next)
      fail(`Structural object cannot be deleted: ${id}`);
    if (
      next &&
      Array.isArray(old.record_refs) &&
      !isDeepStrictEqual(old.record_refs, next.record_refs)
    )
      fail("Existing provenance cannot be replaced through a parent patch.");
  }
  for (const [id, item] of after) {
    if (
      !before.has(id) &&
      Array.isArray(item.record_refs) &&
      item.record_refs.length
    )
      fail("New provenance must be empty.");
    if (
      !isDeepStrictEqual(before.get(id), item) &&
      Array.isArray(item.record_refs) &&
      !item.record_refs.includes(state.id)
    )
      item.record_refs.push(state.id);
    for (const ref of references(item)) {
      const linked = after.get(ref) ?? upstream.get(ref);
      if (!linked) fail(`Unknown Solution reference: ${ref}`);
      if (item.status !== "retired" && linked.status === "retired")
        fail(`Active design refers to retired object: ${ref}`);
    }
  }
  for (const parent of [...root.structure.apps, ...root.structure.packages])
    for (const mod of parent.modules)
      if (mod.parent_ref !== parent.id)
        fail("Module parent_ref does not match its container.");
  for (const scenario of root.scenarios) {
    const participants = new Set(scenario.participants.map((p) => p.id));
    for (const p of scenario.participants) {
      if (["module", "resource"].includes(p.type) !== Boolean(p.ref))
        fail("Participant reference does not match its kind.");
    }
    for (const step of scenario.steps)
      if (
        !participants.has(step.source_ref) ||
        (step.target_ref && !participants.has(step.target_ref))
      )
        fail("Scenario Step references another Scenario's participant.");
  }
  if (state.processedFeedbackCount !== state.feedbacks.length)
    fail("Solution feedback has not been processed.");
  if (state.questions.some((q) => q.answer === undefined && q.skipped !== true))
    fail("Solution has unanswered questions.");
  if (
    state.questions.some((q) => q.skipped) &&
    !root.risks.some((r) => r.status === "active")
  )
    fail("Skipped uncertainty must be retained as an active Risk.");
  if (
    !state.checks.length ||
    new Set(state.checks.map((c) => c.id)).size !== state.checks.length
  )
    fail("A unique nonempty implementation check plan is required.");
  return {
    artifact: solutionArtifactSchema.parse(root),
    originRefs: [...origins].sort(),
  };
}
