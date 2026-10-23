import { digest, json } from "./json.ts";
import { fail } from "./errors.ts";
export type Entity = { id: string };
export const formalId = (prefix: string, runId: string, key: string) =>
  `${prefix}-${digest({ runId, key }).slice(0, 20)}`;
/** Resolve only identity/reference fields; user prose is never rewritten. */
export function resolveRefs<T>(value: T, ids: Record<string, string>): T {
  function visit(v: unknown, key = ""): unknown {
    if (
      typeof v === "string" &&
      v.startsWith("$") &&
      (key === "id" ||
        key.endsWith("Ref") ||
        key.endsWith("Refs") ||
        key === "dependsOn")
    ) {
      if (!ids[v]) fail(`Unresolved temporary reference: ${v}`);
      return ids[v];
    }
    if (Array.isArray(v)) return v.map((item) => visit(item, key));
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, item]) => [k, visit(item, k)]),
      );
    return v;
  }
  return visit(value) as T;
}
export function batchEdit<T extends Record<string, Entity[]>>(
  runId: string,
  draft: T,
  aliases: Record<string, string>,
  edits: { collection: keyof T & string; value: Entity; reason: string }[],
) {
  const next = structuredClone(draft),
    ids = { ...aliases };
  const seen = new Set<string>();
  for (const edit of edits) {
    const id = edit.value.id;
    if (seen.has(id)) fail(`Duplicate edit: ${id}`);
    seen.add(id);
    if (id.startsWith("$"))
      ids[id] ??= formalId(edit.collection.toUpperCase(), runId, id);
    else if (
      !Object.values(draft)
        .flat()
        .some((item) => item.id === id)
    )
      fail(`New objects require a $temporary key: ${id}`);
  }
  const audit = [];
  for (const edit of edits) {
    const value = resolveRefs(edit.value, ids);
    const collection = next[edit.collection];
    if (!collection) fail(`Unknown collection ${edit.collection}`);
    const index = collection.findIndex((item) => item.id === value.id);
    if (
      Object.entries(next).some(
        ([key, list]) =>
          key !== edit.collection && list.some((item) => item.id === value.id),
      )
    )
      fail("An object's collection is immutable.");
    const before = index >= 0 ? collection[index] : null;
    audit.push({
      kind: edit.collection,
      id: value.id,
      reason: edit.reason,
      before: json(before),
      after: json(value),
    });
    if (index >= 0) collection[index] = value;
    else collection.push(value);
  }
  return { draft: next, ids, audit };
}

/** Round objects have Code-owned identities, just like persistent draft objects. */
export function allocateIds(
  runId: string,
  aliases: Record<string, string>,
  groups: { prefix: string; items: Entity[]; existing: Entity[] }[],
) {
  const ids = { ...aliases },
    seen = new Set<string>();
  for (const group of groups)
    for (const item of group.items) {
      if (seen.has(item.id)) fail(`Duplicate round object: ${item.id}`);
      seen.add(item.id);
      if (item.id.startsWith("$")) {
        const expected = formalId(group.prefix, runId, item.id);
        if (ids[item.id] && ids[item.id] !== expected)
          fail(`Temporary key belongs to another object kind: ${item.id}`);
        ids[item.id] = expected;
      } else if (!group.existing.some((previous) => previous.id === item.id))
        fail(`New round objects require a $temporary key: ${item.id}`);
    }
  return ids;
}
