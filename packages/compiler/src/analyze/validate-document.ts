import type * as z from "zod";
import { fail } from "../errors.ts";
import type { SourceDocument } from "../source/types.ts";
import { sourceLocation } from "../source/locations.ts";

export function validateDocument<T>(
  schema: z.ZodType<T>,
  document: SourceDocument,
): T {
  const parsed = schema.safeParse(document.value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const path = issue ? [...issue.path] : [];
  if (issue?.code === "unrecognized_keys" && issue.keys[0])
    path.push(issue.keys[0]);
  fail(
    "INVALID_WORKFLOW",
    `${issue?.message ?? "Invalid document"}. Input bindings, hooks and kernel steps are not supported.`,
    sourceLocation(document, path),
    parsed.error,
  );
}
