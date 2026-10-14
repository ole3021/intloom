import * as z from "zod";
import { isDeepStrictEqual } from "node:util";
import { digest, objects, json } from "./shared.ts";
import type { SpecificationChange } from "../../schemas/specification-record.ts";

/** History is stored by Code and never appears in the authoring view. */
export function authoring(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(authoring);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => k !== "record_refs")
      .map(([k, v]) => [k, authoring(v)]),
  );
}
export const draftRevision = (state: {
  changes: unknown;
  questions: unknown;
  feedbacks: unknown;
}) =>
  digest({
    changes: state.changes,
    questions: state.questions,
    feedbacks: state.feedbacks,
  });
export const editResultSchema = z.discriminatedUnion("saved", [
  z.strictObject({ saved: z.literal(true), draftRevision: z.string() }),
  z.strictObject({
    saved: z.literal(false),
    issues: z.array(z.string()),
    draftRevision: z.string(),
  }),
]);
const pointer = (key: string): `/${string}` =>
  `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;

/** Compile this call's object edits against the actual draft, preserving accepted earlier edits. */
export function objectChanges(
  current: unknown,
  edits: readonly { value: Record<string, unknown>; reason: string }[],
  removeAcceptances: readonly { targetRef: string; reason: string }[] = [],
) {
  const indexed = objects(current);
  const explicit = new Map<string, (typeof edits)[number]>();
  for (const item of edits) {
    const id = String(item.value.id);
    if (explicit.has(id)) throw Error(`Duplicate edit: ${id}`);
    explicit.set(id, item);
  }
  const contained = new Set<string>();
  // A separately edited child overrides its embedded copy before compiling the parent once.
  function expand(
    value: unknown,
    ancestors: Set<string>,
    reasons: Set<string>,
  ): unknown {
    if (Array.isArray(value))
      return value.map((item) => expand(item, ancestors, reasons));
    if (!value || typeof value !== "object") return value;
    let item = value as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : undefined;
    if (id) {
      if (ancestors.has(id)) throw Error(`Cyclic object edit: ${id}`);
      const replacement = explicit.get(id);
      if (replacement) {
        if (ancestors.size) contained.add(id);
        item = replacement.value;
        reasons.add(replacement.reason);
      }
      ancestors = new Set([...ancestors, id]);
    }
    return Object.fromEntries(
      Object.entries(item).map(([key, child]) => [
        key,
        expand(child, ancestors, reasons),
      ]),
    );
  }
  const merged = edits.map((item) => {
    const reasons = new Set([item.reason]);
    return {
      value: expand(item.value, new Set(), reasons) as Record<string, unknown>,
      reasons,
    };
  });
  const result: SpecificationChange[] = [];
  const used = new Set<string>();
  function edit(value: Record<string, unknown>, reason: string) {
    const id = String(value.id);
    if (used.has(id)) throw Error(`Duplicate edit: ${id}`);
    used.add(id);
    const old = indexed.get(id);
    const change = {
      target_ref: id as SpecificationChange["target_ref"],
      reason,
      patch: [] as SpecificationChange["patch"],
    };
    if (!old)
      change.patch.push({
        op: "add",
        path: "",
        value: json(value) as Record<
          string,
          z.infer<ReturnType<typeof z.json>>
        >,
      });
    else {
      for (const key of new Set([...Object.keys(old), ...Object.keys(value)])) {
        if (["id", "record_refs", "acceptances"].includes(key)) continue;
        if (isDeepStrictEqual(old[key], value[key])) continue;
        const path = pointer(key);
        if (Object.hasOwn(old, key))
          change.patch.push({ op: "test", path, value: json(old[key]) });
        if (!Object.hasOwn(value, key))
          change.patch.push({ op: "remove", path });
        else
          change.patch.push({
            op: Object.hasOwn(old, key) ? "replace" : "add",
            path,
            value: json(value[key]),
          });
      }
    }
    if (change.patch.length) result.push(change);
    if (old && Array.isArray(value.acceptances)) {
      const desired = new Set(value.acceptances.map((a) => String(a.id)));
      for (const acceptance of value.acceptances) edit(acceptance, reason);
      if (Array.isArray(old.acceptances))
        for (const acceptance of old.acceptances)
          if (!desired.has(String(acceptance.id)))
            remove(String(acceptance.id), reason);
    }
  }
  function remove(id: string, reason: string) {
    if (used.has(id)) throw Error(`Conflicting edit: ${id}`);
    used.add(id);
    const old = indexed.get(id);
    if (!id.startsWith("SACC-") || !old)
      throw Error(`Unknown Acceptance: ${id}`);
    result.push({
      target_ref: id as SpecificationChange["target_ref"],
      reason,
      patch: [
        { op: "test", path: "", value: json(old) },
        { op: "remove", path: "" },
      ],
    });
  }
  for (const item of merged)
    if (!contained.has(String(item.value.id)))
      edit(item.value, [...item.reasons].join("; "));
  for (const item of removeAcceptances) remove(item.targetRef, item.reason);
  return result;
}
