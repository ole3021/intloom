import type * as z from "zod";
import { failDiagnostics } from "../diagnostics.ts";
import type { SourceDocument } from "../source/types.ts";
import { sourceLocation } from "../source/locations.ts";

export function validateDocument<T>(
  schema: z.ZodType<T>,
  document: SourceDocument,
): T {
  const parsed = schema.safeParse(document.value);
  if (parsed.success) return parsed.data;
  failDiagnostics(
    "INVALID_LOOM",
    parsed.error.issues.map((issue) => {
      const path = [...issue.path];
      if (issue.code === "unrecognized_keys" && issue.keys[0])
        path.push(issue.keys[0]);
      return {
        severity: "error",
        code: "INVALID_LOOM",
        message: `${path.length ? `${path.join(".")}: ` : ""}${issue.message}`,
        location: sourceLocation(document, path),
      };
    }),
    parsed.error,
  );
}
