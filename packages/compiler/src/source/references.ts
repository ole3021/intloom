import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fail } from "../errors.ts";
import type { SourceResource } from "./types.ts";

export type ResourceKind = SourceResource["kind"];

export function isPathWithin(root: string, file: string): boolean {
  const path = relative(root, file);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

/** Resource kind comes from the declaration, never from a directory name. */
export function resolveReference(
  root: string,
  reference: string,
  kind: ResourceKind,
  fromFile = resolve(root, "package.json"),
) {
  const match = /^(\.\.?\/[^#]+)(?:#([A-Za-z_$][\w$]*))?$/.exec(reference);
  if (!match?.[1] || reference.includes("\\"))
    fail(
      "INVALID_REFERENCE",
      `Invalid relative resource reference: ${reference}`,
    );
  const file = resolve(dirname(fromFile), match[1]);
  const suffix =
    kind === "stage"
      ? ".yaml"
      : kind === "agent" || kind === "skill"
        ? ".md"
        : ".ts";
  if (
    !isPathWithin(root, file) ||
    !file.endsWith(suffix) ||
    file.endsWith(".d.ts")
  )
    fail(
      "INVALID_REFERENCE",
      `Resource must be a ${suffix} source file inside packageRoot: ${reference}`,
    );
  if ((kind === "stage" || kind === "agent" || kind === "skill") && match[2])
    fail(
      "INVALID_REFERENCE",
      `This resource has no module export selector: ${reference}`,
    );
  return { file, kind, exportName: match[2] ?? "default" };
}
