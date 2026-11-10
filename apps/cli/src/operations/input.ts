import { heading, wrapText } from "../ui/theme.ts";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { formValue, pathList } from "../ui/form.ts";
import assert from "node:assert/strict";
import { choose, interactive } from "../ui/prompts.ts";
import { IntloomError, type JsonObject } from "@intloom/loom-sdk";
import type { CommandContext } from "../context.ts";

export function structuredInput(input: unknown, pathField?: string) {
  const inputFiles: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (
      "kind" in value &&
      value.kind === "input-file" &&
      "path" in value &&
      typeof value.path === "string"
    ) {
      value.path = resolve(value.path);
    } else {
      for (const item of Object.values(value)) visit(item);
    }
  };
  visit(input);
  if (pathField && input && typeof input === "object") {
    const paths = (input as JsonObject)[pathField];
    if (Array.isArray(paths))
      for (const path of paths) {
        if (
          typeof path === "string" &&
          statSync(path, { throwIfNoEntry: false })?.isFile()
        )
          inputFiles.push(resolve(path));
      }
  }
  return { input, ...(inputFiles.length && { inputFiles }) };
}

export async function runInput(
  ctx: CommandContext,
  schema: JsonObject,
  loom: string,
): Promise<{ input?: unknown; pathField?: string }> {
  const raw = ctx.string("input");
  const prompt = ctx.string("prompt");
  const files = ctx.string("files");
  const paths = ctx.string("paths");
  const fields: Record<string, unknown> = {};
  let pathField: string | undefined;
  const shorthand =
    prompt !== undefined || files !== undefined || paths !== undefined;
  if (raw !== undefined) {
    if (shorthand)
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Use --input or --prompt/--files/--paths.",
      );
    const input = await ctx.readJson(raw);
    return { input };
  }
  if (
    schema.type === "string" &&
    prompt !== undefined &&
    files === undefined &&
    paths === undefined
  )
    return { input: prompt };
  let introduced = false;
  const introduce = () => {
    if (introduced) return;
    process.stderr.write(
      `${wrapText(`${heading(process.stderr, "Input")}\nLoom  ${loom}\n`, process.stderr)}\n`,
    );
    introduced = true;
  };
  const properties = (schema.properties ?? {}) as Record<string, JsonObject>;
  const set = async (name: string, text: string | string[]) => {
    let fieldName = name;
    if (!Object.hasOwn(properties, name)) {
      const candidates = Object.entries(properties)
        .filter(
          ([key, field]) =>
            !Object.hasOwn(fields, key) &&
            field.type === (name === "prompt" ? "string" : "array"),
        )
        .map(([key]) => key);
      if (!interactive() || !candidates.length)
        throw new IntloomError(
          "INPUT_INVALID",
          `This Loom has no "${name}" input. Supply its declared fields via --input.`,
        );
      introduce();
      const index = await choose(
        `Which field should receive --${name}?`,
        candidates,
      );
      const selected = candidates[index];
      assert.ok(selected !== undefined);
      fieldName = selected;
    }
    if (name === "prompt") {
      fields[fieldName] = text;
      return;
    }
    const entries = (Array.isArray(text) ? text : text.split(";"))
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => resolve(p));
    if (!entries.length)
      throw new IntloomError(
        "INPUT_INVALID",
        `Choose at least one entry for ${name}.`,
      );
    if (name === "files") {
      for (const path of entries) {
        if (!statSync(path, { throwIfNoEntry: false })?.isFile())
          throw new IntloomError(
            "INPUT_FILE_MISSING",
            `Input file is unavailable: ${path}`,
          );
      }
      fields[fieldName] = entries.map((path) => ({ kind: "input-file", path }));
    } else {
      pathField = fieldName;
      fields[fieldName] = entries;
    }
  };
  if (prompt !== undefined) await set("prompt", prompt);
  if (files !== undefined) await set("files", files);
  if (paths !== undefined) await set("paths", paths);
  if (interactive() && !(schema.default !== undefined && !shorthand)) {
    if (schema.type !== "object" || !schema.properties) {
      introduce();
      return { input: await formValue(schema, "Input") };
    }
    for (const name of (schema.required ?? []) as string[]) {
      if (Object.hasOwn(fields, name)) continue;
      introduce();
      const field = properties[name] ?? {};
      if (field.type === "array" && (name === "files" || name === "paths"))
        await set(name, await pathList(name));
      else fields[name] = await formValue(field, name);
    }
    return { input: fields, ...(pathField && { pathField }) };
  }
  return {
    ...(shorthand && { input: fields }),
    ...(pathField && { pathField }),
  };
}
