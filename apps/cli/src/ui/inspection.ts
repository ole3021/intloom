import stringWidth from "string-width";
import { heading, wrapText, paint } from "./theme.ts";
import type { LoomSummary, JsonObject, JsonValue } from "@intloom/loom-sdk";
import type { inspectLoomPackage } from "@intloom/kernel";

export function schemaSummary(schema: JsonObject): string {
  const fields = schema.properties;
  if (
    schema.type !== "object" ||
    !fields ||
    typeof fields !== "object" ||
    Array.isArray(fields)
  )
    return typeof schema.type === "string"
      ? schema.type
      : JSON.stringify(schema);
  const required = Array.isArray(schema.required) ? schema.required : [];
  return (
    Object.entries(fields)
      .map(([name, field]) => {
        const spec =
          field && typeof field === "object" && !Array.isArray(field)
            ? field
            : {};
        const type: JsonValue = spec.type ?? (spec.enum ? "enum" : "value");
        return `${name} (${type}, ${required.includes(name) ? "required" : "optional"}${spec.default === undefined ? "" : `, default ${JSON.stringify(spec.default)}`})`;
      })
      .join(", ") || "object"
  );
}

export function formatInspection(
  report: Awaited<ReturnType<typeof inspectLoomPackage>>,
): string {
  const packages = [report.root, ...report.dependencies].map((item, index) => {
    const lines = [
      `${index ? "Bundled dependency" : "Loom"}: ${item.name} (${item.id}@${item.version})`,
      item.description,
      `npm: ${item.npmName} · Entry: ${item.entry.kind}/${item.entry.id}`,
      `SHA-256: ${item.artifactDigest}`,
      `Storage: ${item.storage}`,
      `Input: ${schemaSummary(item.input)}`,
      `Output: ${schemaSummary(item.output)}`,
      `Delivery: ${item.outcome?.description ?? "See output schema"}`,
    ];
    for (const [slot, artifact] of Object.entries(
      item.outcome?.artifacts ?? {},
    ))
      lines.push(
        `  ${slot}: ${artifact.mediaTypes?.join(", ") ?? "file"} at ${artifact.at || "/"}`,
      );
    for (const check of item.outcome?.acceptance?.criteria ?? [])
      lines.push(`  Acceptance ${check.id}: ${check.description}`);
    lines.push(
      `Node: ${item.requirements.node}`,
      `Model slots: ${
        Object.entries(item.requirements.models)
          .map(([slot, caps]) => [slot, ...caps].join(" / "))
          .join(", ") || "none"
      }`,
      `Runtime tools: ${item.requirements.tools.join(", ") || "none"}`,
      `Possible interactions: ${item.possibleInteractions.map((i) => `${i.workflow}/${i.step} (${i.responsePolicy})`).join(", ") || "none declared"}`,
      `Locked dependencies: ${
        Object.entries(item.dependencies)
          .map(
            ([alias, r]) =>
              `${alias} = ${r.id}@${r.version} (${r.artifactDigest})`,
          )
          .join(", ") || "none"
      }`,
      "Files:",
      ...item.files.map((f) => `  ${f}`),
    );
    return lines.join("\n");
  });
  return `${packages.join("\n\n")}\n`;
}

export function loomListText(
  entries: readonly LoomSummary[],
  stream: NodeJS.WriteStream,
) {
  const lines = [heading(stream, "Looms"), ""];
  if (!entries.length) return lines.concat("No Looms installed.").join("\n");
  const headers = ["LOOM", "VERSION"] as const;
  const rows = entries.map(
    (item) => [item.ref.id, item.ref.version, item.description] as const,
  );
  const columns = ([0, 1] as const).map((index) => ({
    index,
    width: Math.max(
      stringWidth(headers[index]),
      ...rows.map((row) => stringWidth(row[index])),
    ),
  }));
  const prefixWidth = columns.reduce((sum, { width }) => sum + width + 2, 0);
  const descriptionWidth = (stream.columns || 80) - prefixWidth - 1;
  if (descriptionWidth < 20) {
    for (const item of entries)
      lines.push(
        `${item.ref.id}@${item.ref.version}`,
        `  ${item.description}`,
        "",
      );
  } else {
    const prefix = (row: readonly [string, string, ...string[]]) =>
      columns
        .map(
          ({ index, width }) =>
            row[index] + " ".repeat(width - stringWidth(row[index]) + 2),
        )
        .join("");
    lines.push(paint(stream, "dim", `${prefix(headers)}DESCRIPTION`));
    for (const row of rows) {
      const description = wrapText(row[2], {
        columns: descriptionWidth + 1,
      } as NodeJS.WriteStream).split("\n");
      lines.push(prefix(row) + description[0]);
      for (const line of description.slice(1))
        lines.push(" ".repeat(prefixWidth) + line);
    }
  }
  return wrapText(lines.join("\n"), stream);
}
