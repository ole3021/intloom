import { isDeepStrictEqual } from "node:util";
import * as z from "zod";
import {
  specificationArtifactSchema,
  type SpecificationArtifact,
  type SpecificationObjectId,
} from "../../schemas/specification-artifact.ts";
import type { SpecificationChange } from "../../schemas/specification-record.ts";
import { fail } from "./errors.ts";

type Value = z.infer<ReturnType<typeof z.json>>;
type ObjectValue = { [key: string]: Value };
const collections: Record<string, string> = {
  SDOM: "domains",
  SFEA: "features",
  SREQ: "requirements",
  SCON: "constraints",
  SREL: "relations",
  SDEF: "deferreds",
};
export function emptyArtifact(): SpecificationArtifact {
  return {
    domains: [],
    features: [],
    requirements: [],
    constraints: [],
    relations: [],
    deferreds: [],
  };
}
function object(value: Value | undefined): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Expected an object");
  return value;
}
function list(value: Value | undefined): Value[] {
  if (!Array.isArray(value)) fail("Expected an array");
  return value;
}
function indexObjects(root: ObjectValue): Map<string, ObjectValue> {
  const result = new Map<string, ObjectValue>();
  function add(value: Value) {
    const item = object(value);
    if (typeof item.id !== "string" || result.has(item.id))
      fail(`Duplicate or invalid object ID: ${item.id}`);
    result.set(item.id, item);
    if (Array.isArray(item.acceptances)) item.acceptances.forEach(add);
  }
  for (const items of Object.values(root)) list(items).forEach(add);
  return result;
}
export function validateArtifact(value: unknown): SpecificationArtifact {
  const parsed = specificationArtifactSchema.safeParse(value);
  if (!parsed.success) fail(`Artifact schema: ${parsed.error.message}`);
  const artifact = parsed.data;
  const objects = indexObjects(object(z.json().parse(artifact)));
  const ref = (id: string, prefix: string, active: boolean) => {
    const target = objects.get(id);
    if (
      !target ||
      !id.startsWith(prefix) ||
      (active && target.status !== "active")
    )
      fail(`Missing or inactive reference: ${id}`);
  };
  for (const feature of artifact.features)
    ref(feature.domain_ref, "SDOM-", feature.status === "active");
  for (const requirement of artifact.requirements) {
    ref(requirement.feature_ref, "SFEA-", requirement.status === "active");
    for (const acceptance of requirement.acceptances)
      if (acceptance.requirement_ref !== requirement.id)
        fail(`Acceptance has the wrong parent: ${acceptance.id}`);
  }
  for (const relation of artifact.relations) {
    ref(relation.source_req_ref, "SREQ-", relation.status === "active");
    ref(relation.target_req_ref, "SREQ-", relation.status === "active");
    if (relation.source_req_ref === relation.target_req_ref)
      fail(`Self relation: ${relation.id}`);
  }
  for (const deferred of artifact.deferreds)
    for (const id of deferred.impact_refs)
      ref(id, id.split("-")[0] ?? "", deferred.status === "active");
  for (const item of objects.values())
    if (
      Array.isArray(item.record_refs) &&
      new Set(item.record_refs).size !== item.record_refs.length
    )
      fail(`Duplicate record_refs: ${item.id}`);
  return artifact;
}
function tokens(path: string): string[] {
  if (path === "") return [];
  return path
    .slice(1)
    .split("/")
    .map((part) => {
      if (/~(?![01])/u.test(part)) fail(`Invalid JSON pointer: ${path}`);
      const decoded = part.replaceAll("~1", "/").replaceAll("~0", "~");
      if (["__proto__", "prototype", "constructor"].includes(decoded))
        fail(`Forbidden patch path: ${path}`);
      return decoded;
    });
}
function references(value: Value | undefined): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(references);
  return Object.entries(value).flatMap(([key, child]) => {
    if (key === "record_refs") return [];
    if (key.endsWith("_ref") && typeof child === "string") return [child];
    if (key.endsWith("_refs") && Array.isArray(child))
      return child.filter((v): v is string => typeof v === "string");
    return references(child);
  });
}

export function applyChanges(
  baseline: SpecificationArtifact,
  changes: readonly SpecificationChange[],
  runId: string,
): { artifact: SpecificationArtifact; originRefs: SpecificationObjectId[] } {
  validateArtifact(baseline);
  const root = object(z.json().parse(structuredClone(baseline)));
  const original = indexObjects(root);
  const used = new Set(original.keys());
  const origins = new Set<string>();
  const touched = new Set<string>();
  for (const change of changes) {
    const before = structuredClone(indexObjects(root).get(change.target_ref));
    let target = indexObjects(root).get(change.target_ref);
    const acceptance = change.target_ref.startsWith("SACC-");
    function containing(item: ObjectValue): Value[] {
      if (acceptance) {
        const parent = indexObjects(root).get(String(item.requirement_ref));
        if (parent?.status !== "active")
          fail(`Missing active Acceptance parent: ${item.requirement_ref}`);
        touched.add(String(parent.id));
        return list(parent.acceptances);
      }
      const key = collections[change.target_ref.split("-")[0] ?? ""];
      if (!key) fail(`Unknown target: ${change.target_ref}`);
      return list(root[key]);
    }
    for (const [position, patch] of change.patch.entries()) {
      const path = tokens(patch.path);
      if (patch.op === "replace" || patch.op === "remove") {
        const previous = change.patch[position - 1];
        if (previous?.op !== "test" || previous.path !== patch.path)
          fail(
            "replace/remove requires an immediately preceding test of the same path",
          );
      }
      if (path.length === 0) {
        if (patch.op === "test") {
          if (!target || !isDeepStrictEqual(target, patch.value))
            fail(`Root test failed: ${change.target_ref}`);
        } else if (patch.op === "add") {
          if (target || used.has(change.target_ref))
            fail(`Object ID already used: ${change.target_ref}`);
          const item = object(structuredClone(patch.value));
          if (item.id !== change.target_ref)
            fail("New object ID must match target_ref");
          if (
            item.record_refs !== undefined &&
            list(item.record_refs).length !== 0
          )
            fail("New record_refs must be empty");
          const nested = Array.isArray(item.acceptances)
            ? item.acceptances.map((a) => String(object(a).id))
            : [];
          for (const id of [change.target_ref, ...nested]) {
            if (used.has(id)) fail(`Object ID already used: ${id}`);
            used.add(id);
          }
          containing(item).push(item);
          target = item;
        } else if (patch.op === "remove" && acceptance && target) {
          const items = containing(target);
          items.splice(items.indexOf(target), 1);
          target = undefined;
        } else
          fail(
            "Existing root objects cannot be replaced or removed; only Acceptance can be removed",
          );
      } else {
        if (!target) fail(`Unknown target: ${change.target_ref}`);
        const first = path[0];
        if (
          patch.op !== "test" &&
          (first === "id" ||
            first === "record_refs" ||
            first === "acceptances" ||
            (acceptance && first === "requirement_ref"))
        )
          fail(`Field is managed by Code or requires its own target: ${first}`);
        // Mutable arrays are replaced at field level; identified objects always use target_ref.
        let parent = target;
        for (const token of path.slice(0, -1)) parent = object(parent[token]);
        const key = path.at(-1);
        if (key === undefined) fail("Invalid empty path");
        const exists = Object.hasOwn(parent, key);
        if (patch.op === "test") {
          if (!exists || !isDeepStrictEqual(parent[key], patch.value))
            fail(`Patch test failed: ${change.target_ref}${patch.path}`);
        } else if (patch.op === "add") {
          if (exists) fail("add cannot overwrite an existing field");
          parent[key] = structuredClone(patch.value);
        } else {
          if (!exists) fail("Patch field does not exist");
          if (patch.op === "remove") delete parent[key];
          else parent[key] = structuredClone(patch.value);
        }
      }
    }
    if (isDeepStrictEqual(before, target))
      fail(`Change has no effect: ${change.target_ref}`);
    if (original.has(change.target_ref)) origins.add(change.target_ref);
    for (const ref of [...references(before), ...references(target)])
      if (original.has(ref)) origins.add(ref);
    if (acceptance) {
      const parentId = String((target ?? before)?.requirement_ref);
      touched.add(parentId);
      if (original.has(parentId)) origins.add(parentId);
    } else touched.add(change.target_ref);
  }
  if (changes.length && isDeepStrictEqual(root, baseline))
    fail("Changes cancel out without any net effect");
  for (const id of touched) {
    const item = indexObjects(root).get(id);
    if (
      item &&
      Array.isArray(item.record_refs) &&
      !item.record_refs.includes(runId)
    )
      item.record_refs.push(runId);
  }
  return {
    artifact: validateArtifact(root),
    originRefs: [...origins].sort() as SpecificationObjectId[],
  };
}
