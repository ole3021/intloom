import { isDeepStrictEqual } from "node:util";
import { solutionArtifactSchema } from "../../schemas/solution-artifact.ts";
import {
  emptySolution,
  type SolutionState,
} from "../../schemas/solution-state.ts";
import {
  fail,
  objects,
  references,
  initializeProvenance,
} from "../flow/shared.ts";

export function reviewSolution(
  state: SolutionState,
  draftOnly = false,
  materializeOnly = false,
) {
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
  function containing(
    item: Record<string, unknown>,
    reject: (message: string, rule?: string) => never,
  ): unknown[] {
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
        reject("Module parent does not exist.", "MODULE_PARENT_NOT_FOUND");
      return parent.modules;
    }
    const collection = collections[id.split("-")[0] ?? ""];
    if (!collection)
      reject(`Unsupported Solution target ${id}`, "TARGET_KIND_UNSUPPORTED");
    return collection;
  }
  for (const [changeIndex, change] of state.changes.entries()) {
    let target = objects(root).get(change.target_ref);
    const original = structuredClone(target);
    for (const [position, patch] of change.patch.entries()) {
      function reject(message: string, rule = "SOLUTION_PATCH_INVALID"): never {
        return fail(
          `Change[${changeIndex}] target_ref ${change.target_ref}, patch[${position}] path ${JSON.stringify(patch.path)}: rule ${rule}: ${message}`,
        );
      }
      if (patch.path === "") {
        if (patch.op !== "add" || target || before.has(change.target_ref))
          reject(
            "Solution object roots can only be added with new identities.",
            "NEW_OBJECT_REQUIRED",
          );
        if (
          !patch.value ||
          typeof patch.value !== "object" ||
          Array.isArray(patch.value)
        )
          reject(
            "New Solution object must be an object.",
            "OBJECT_VALUE_REQUIRED",
          );
        target = structuredClone(patch.value) as Record<string, unknown>;
        if ("item" in target)
          reject(
            "patch.value.item is an invalid wrapper. Put the complete object directly in patch.value with id equal to target_ref; do not submit {item: object}.",
            "OBJECT_VALUE_WRAPPED",
          );
        if (target.id !== change.target_ref)
          reject(
            "Object identity must match target_ref.",
            "OBJECT_ID_MISMATCH",
          );
        initializeProvenance(
          target,
          /^O(CON|DEC|RISK|DIAG)-/u.test(change.target_ref),
        );
        containing(target, reject).push(target);
      } else {
        if (!target)
          reject(
            "Unknown Solution target. Every submission replaces the complete cumulative draft against the committed baseline; retain the root add for this uncommitted new object before its field patches.",
            "TARGET_NOT_FOUND",
          );
        if (/~(?![01])/u.test(patch.path))
          reject("Invalid JSON pointer.", "PATCH_PATH_INVALID");
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
          reject(
            "Identity and provenance are managed by Code.",
            "MANAGED_FIELD",
          );
        let parent: Record<string, unknown> | unknown[] = target;
        for (const part of parts.slice(0, -1)) {
          const next: unknown = Reflect.get(parent, part);
          if (!next || typeof next !== "object")
            reject("Invalid patch path.", "PATCH_PATH_NOT_FOUND");
          parent = next as Record<string, unknown>;
        }
        const key = parts.at(-1);
        if (key === undefined)
          reject("Missing patch field.", "PATCH_FIELD_MISSING");
        const exists = Object.hasOwn(parent, key);
        if (patch.op === "test") {
          if (
            !exists ||
            !isDeepStrictEqual(Reflect.get(parent, key), patch.value)
          )
            reject("Solution patch test failed.", "OLD_VALUE_TEST_FAILED");
        } else if (Array.isArray(parent)) {
          const index = key === "-" ? parent.length : Number(key);
          if (
            !Number.isInteger(index) ||
            index < 0 ||
            index > parent.length ||
            (key !== "-" && String(index) !== key)
          )
            reject("Invalid array index.", "ARRAY_INDEX_INVALID");
          if (patch.op === "add")
            parent.splice(index, 0, structuredClone(patch.value));
          else {
            if (index === parent.length)
              reject("Missing array element.", "ARRAY_ELEMENT_NOT_FOUND");
            if (patch.op === "remove") parent.splice(index, 1);
            else parent[index] = structuredClone(patch.value);
          }
        } else if (patch.op === "remove") {
          if (!exists) reject("Missing field.", "FIELD_NOT_FOUND");
          Reflect.deleteProperty(parent, key);
        } else {
          if (
            (patch.op === "replace" && !exists) ||
            (patch.op === "add" && exists)
          )
            reject("Invalid patch field operation.", "FIELD_OPERATION_INVALID");
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
  const historyIds = new Set(
    [...root.concepts, ...root.decisions, ...root.risks, ...root.diagrams].map(
      (item) => item.id,
    ),
  );
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
    if (!before.has(id) && historyIds.has(id)) item.record_refs = [];
    if (
      !isDeepStrictEqual(before.get(id), item) &&
      Array.isArray(item.record_refs) &&
      !item.record_refs.includes(state.id)
    )
      item.record_refs.push(state.id);
    if (!materializeOnly)
      references(item, (ref, path) => {
        const linked = after.get(ref) ?? upstream.get(ref);
        if (!linked)
          fail(
            `Solution target_ref ${id}, path ${JSON.stringify(path)}: rule REFERENCE_NOT_FOUND: Unknown Solution reference: ${ref}. Use an existing design, participant or confirmed Specification identity, or omit an optional target_ref; an actor label is not an identity.`,
          );
        if (item.status !== "retired" && linked.status === "retired")
          fail(
            `Solution target_ref ${id}, path ${JSON.stringify(path)}: rule ACTIVE_REFERENCE_RETIRED: Active design refers to retired object: ${ref}`,
          );
      });
  }
  for (const parent of [...root.structure.apps, ...root.structure.packages])
    for (const mod of parent.modules)
      if (mod.parent_ref !== parent.id)
        fail("Module parent_ref does not match its container.");
  for (const scenario of root.scenarios) {
    const participants = new Set(scenario.participants.map((p) => p.id));
    for (const p of scenario.participants) {
      if (["module", "resource"].includes(p.type) !== Boolean(p.ref))
        fail(
          `Scenario ${scenario.id}, participant ${p.id}: ${p.type} ${["module", "resource"].includes(p.type) ? "requires ref pointing to an existing module/resource object" : "must omit ref"}. No edits from the rejected batch were saved.`,
        );
    }
    for (const step of scenario.steps)
      if (
        !participants.has(step.source_ref) ||
        (step.target_ref && !participants.has(step.target_ref))
      )
        fail("Scenario Step references another Scenario's participant.");
  }
  if (!draftOnly && state.processedFeedbackCount !== state.feedbacks.length)
    fail("Solution feedback has not been processed.");
  if (
    !draftOnly &&
    state.questions.some((q) => q.answer === undefined && q.skipped !== true)
  )
    fail("Solution has unanswered questions.");
  if (
    !draftOnly &&
    state.questions.some((q) => q.skipped) &&
    !root.risks.some((r) => r.status === "active")
  )
    fail("Skipped uncertainty must be retained as an active Risk.");
  if (
    !draftOnly &&
    (!state.checks.length ||
      new Set(state.checks.map((c) => c.id)).size !== state.checks.length)
  )
    fail("A unique nonempty implementation check plan is required.");
  return {
    artifact: solutionArtifactSchema.parse(root),
    originRefs: [...origins].sort(),
  };
}
