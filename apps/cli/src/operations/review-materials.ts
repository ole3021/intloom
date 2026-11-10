import { stripVTControlCharacters } from "node:util";
import {
  IntloomError,
  type ArtifactRecord,
  type InteractionRequest,
  type JsonValue,
} from "@intloom/loom-sdk";
import type { CommandContext } from "../context.ts";
import { cliName } from "../metadata.ts";

export async function reviewMaterials(
  ctx: CommandContext,
  request: InteractionRequest,
) {
  const refs = new Set<string>();
  function describe(value: JsonValue): JsonValue {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(describe);
    if (
      value.kind === "artifact" &&
      value.runId === request.runId &&
      typeof value.id === "string"
    ) {
      refs.add(value.id);
      return "See artifacts below";
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, describe(v)]),
    );
  }
  if (request.context === undefined) return;
  const summary = describe(request.context);
  process.stderr.write(`Context  ${JSON.stringify(summary)}\n`);
  for (const id of refs) {
    let file: ArtifactRecord;
    try {
      file = await ctx.client("getArtifact", [id]);
    } catch (error) {
      if (
        !(error instanceof IntloomError) ||
        error.code !== "ARTIFACT_NOT_FOUND"
      )
        throw error;
      process.stderr.write(`Artifact unavailable  ${id}\n`);
      continue;
    }
    if (file.runId !== request.runId) {
      process.stderr.write(`Artifact belongs to a different Run  ${id}\n`);
      continue;
    }
    if (!file.mediaType.startsWith("text/")) {
      process.stderr.write(
        `${file.name} · ${cliName} artifact export ${id} --out <path>\n`,
      );
      continue;
    }
    const range = (await ctx.client("readArtifact", [
      { artifactId: id, offset: 0, length: 2048 },
    ])) as { data: string; eof: boolean };
    const content = stripVTControlCharacters(
      Buffer.from(range.data, "base64").toString("utf8"),
    ).replaceAll("\r", "");
    const lines = content.split("\n");
    process.stderr.write(
      `\n${file.name}\n${lines.slice(0, 8).join("\n").trimEnd()}\n`,
    );
    if (!range.eof || lines.length > 8)
      process.stderr.write(`… ${cliName} artifact read ${id}\n`);
  }
}
