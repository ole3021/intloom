import type { JsonObject, OutcomeContract } from "@intloom/loom-sdk";
import { PackageError } from "@intloom/loom-sdk/package-format";

/** Reject relationships disproved by the schema; runtime delivery checks actual values. */
export function inspectOutcome(
  outcome: OutcomeContract,
  output: JsonObject,
): void {
  function at(schema: unknown, parts: string[]): Record<string, unknown>[] {
    if (!schema || typeof schema !== "object" || Array.isArray(schema))
      return schema === true ? [{}] : [];
    const s = schema as Record<string, unknown>;
    const alternatives = s.anyOf ?? s.oneOf;
    if (Array.isArray(alternatives))
      return alternatives.flatMap((item) => at(item, parts));
    if (!parts.length) return [s];
    const key = parts[0] as string;
    const rest = parts.slice(1);
    if (s.type === "object") {
      const property = (s.properties as Record<string, unknown> | undefined)?.[
        key
      ];
      if (property) return at(property, rest);
      return s.additionalProperties && s.additionalProperties !== false
        ? at(s.additionalProperties, rest)
        : [];
    }
    if (s.type === "array" && /^(0|[1-9]\d*)$/.test(key))
      return at(
        Array.isArray(s.prefixItems)
          ? (s.prefixItems[Number(key)] ?? s.items)
          : s.items,
        rest,
      );
    return s.type === undefined ? [{}] : [];
  }
  const locate = (pointer: string) =>
    at(
      output,
      pointer === ""
        ? []
        : pointer
            .slice(1)
            .split("/")
            .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~")),
    );
  function reference(pointer: string, kind: string, multiple = false): void {
    const candidates = locate(pointer).flatMap((s) =>
      multiple
        ? s.type === "array"
          ? Array.isArray(s.prefixItems)
            ? [...s.prefixItems, ...(s.items ? [s.items] : [])].flatMap(
                (item) => at(item, []),
              )
            : at(s.items, [])
          : s.type === undefined
            ? [{}]
            : []
        : [s],
    );
    if (
      !candidates.some((s) => {
        if (s.type === undefined) return true;
        if (s.type !== "object") return false;
        const properties = s.properties as
          | Record<string, Record<string, unknown>>
          | undefined;
        return (
          properties?.kind?.const === kind &&
          properties.id?.type === "string" &&
          properties.runId?.type === "string"
        );
      })
    )
      throw new PackageError(
        "OUTCOME_CONTRACT_INVALID",
        `${pointer}: output cannot provide ${multiple ? "an array of " : ""}${kind} references.`,
      );
  }
  for (const artifact of Object.values(outcome.artifacts ?? {}))
    reference(artifact.at, "artifact", artifact.multiple);
  if (outcome.acceptance) {
    reference(outcome.acceptance.at, "acceptance");
    if (!locate(outcome.acceptance.subjectAt).length)
      throw new PackageError(
        "OUTCOME_CONTRACT_INVALID",
        `${outcome.acceptance.subjectAt}: subject is absent from output.`,
      );
  }
}
