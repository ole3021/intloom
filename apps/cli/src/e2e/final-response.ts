import * as z from "zod";
import { E2eError } from "./contracts.ts";
import { toolSchema } from "./schema.ts";

export const userDecisionSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("finished") }),
  z.strictObject({
    status: z.literal("blocked"),
    category: z.enum(["scenario", "environment"]),
    reason: z.string().trim().min(1),
  }),
]);

// Expose properties directly to Tool models; the final parser keeps conditional rules.
export const userDecisionToolSchema = z.strictObject({
  status: z.enum(["finished", "blocked"]),
  category: z.enum(["scenario", "environment"]).optional(),
  reason: z.string().trim().min(1).optional(),
});

export function parseFinalResponse(
  text: string,
  allowDecisionPreamble: boolean | "schema" = false,
) {
  const trimmed = text
    .trim()
    .replace(/```json\s*\n?([\s\S]*?)\n?\s*```$/u, "$1")
    .trim();
  try {
    return { value: JSON.parse(trimmed) as unknown, format: "json" };
  } catch {
    if (allowDecisionPreamble) {
      const spans: string[] = [];
      let depth = 0,
        start = 0,
        quoted = false,
        escaped = false;
      for (let index = 0; index < trimmed.length; index++) {
        const char = trimmed[index];
        if (depth && quoted) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') quoted = false;
        } else if (depth && char === '"') quoted = true;
        else if (char === "{" || char === "[") {
          if (!depth) start = index;
          depth++;
        } else if (depth && (char === "}" || char === "]")) {
          if (--depth === 0) spans.push(trimmed.slice(start, index + 1));
        }
      }
      const suffix = spans[0];
      if (!depth && spans.length === 1 && suffix && trimmed.endsWith(suffix)) {
        try {
          const decoded = JSON.parse(suffix) as unknown;
          const value =
            allowDecisionPreamble === "schema"
              ? decoded
              : userDecisionSchema.parse(decoded);
          return {
            value,
            format:
              allowDecisionPreamble === "schema"
                ? "schema_with_preamble"
                : "decision_with_preamble",
          };
        } catch {
          /* Ambiguous, malformed or unknown decisions remain failures. */
        }
      }
    }
    throw new E2eError(
      "MODEL_OUTPUT_INVALID",
      "The test AI final response is not valid JSON.",
      "model",
    );
  }
}

export async function parseStructuredResponse(text: string, schema: unknown) {
  const decoded = parseFinalResponse(text, "schema");
  const result = await toolSchema(schema)["~standard"].validate(decoded.value);
  if (result.issues?.length)
    throw new E2eError(
      "MODEL_OUTPUT_INVALID",
      "The test AI final response does not match the host Agent output schema.",
      "model",
    );
  return decoded;
}
