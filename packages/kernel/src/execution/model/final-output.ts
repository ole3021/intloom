import { ERRORS } from "../../errors.ts";

export function parseFinalAgentOutput(text: string | undefined): unknown {
  if (!text?.trim())
    throw ERRORS.create("AGENT_OUTPUT_INVALID", {
      message:
        "The final model response is empty. Return the required JSON result.",
    });
  const trimmed = text
    .trim()
    .replace(/```json\s*\n?([\s\S]*?)\n?\s*```\s*$/u, "$1")
    .trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Accept one complete trailing value from this final round only; no cached output or inferred outcome.
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
    const value = spans[0];
    if (!depth && spans.length === 1 && value && trimmed.endsWith(value)) {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        // Malformed, ambiguous and truncated values remain failures.
      }
    }
    throw ERRORS.create("AGENT_OUTPUT_INVALID", {
      message:
        "The final model response is not complete, unambiguous JSON. Return the required JSON result.",
    });
  }
}
