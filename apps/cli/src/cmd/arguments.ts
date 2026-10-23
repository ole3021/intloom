import type { ArgsDef } from "citty";
import { parseArtifactQuery } from "@intloom/kernel/operations";
import { failure } from "../errors.ts";

export const str = (description: string) => ({
  type: "string" as const,
  description,
});
export const bool = (description: string) => ({
  type: "boolean" as const,
  description,
});
export const pos = (description: string, required = true) => ({
  type: "positional" as const,
  description,
  required,
});
export const globals = {
  project: str("Project directory"),
  json: bool("JSON result or JSON Lines"),
  interactive: bool("Allow setup choices"),
  color: bool("Enable color"),
  debug: bool("Debug log filter"),
  info: bool("Info log filter"),
};
export type Values = Record<string, unknown> & { _: string[] };
export function invalid(message: string): never {
  throw failure("INVALID_REQUEST", message);
}
export function value(a: Values, name: string, required: true): string;
export function value(
  a: Values,
  name: string,
  required?: false,
): string | undefined;
export function value(
  a: Values,
  name: string,
  required = false,
): string | undefined {
  const item = a[name];
  if (item === undefined && !required) return undefined;
  if (typeof item !== "string" || !item.trim())
    invalid(`Provide a nonempty ${name}.`);
  return item;
}
export function integer(
  a: Values,
  name: string,
  max: number,
  min = 0,
): number | undefined {
  const item = value(a, name);
  if (item === undefined) return undefined;
  if (!/^\d+$/u.test(item) || Number(item) < min || Number(item) > max)
    invalid(`${name} must be between ${min} and ${max}.`);
  return Number(item);
}
export function validateArguments(a: Values, flags: ArgsDef): Values {
  const known = new Set(
    Object.entries(flags).flatMap(([key, flag]) => [
      ...["alias" in flag ? (flag.alias ?? []) : []].flat(),
      key,
      key.replace(/-([a-z])/gu, (_match, letter: string) =>
        letter.toUpperCase(),
      ),
    ]),
  );
  for (const key of Object.keys(a))
    if (key !== "_" && !known.has(key)) invalid(`Unknown option: --${key}`);
  if (
    a._.length >
    Object.values(flags).filter((flag) => flag.type === "positional").length
  )
    invalid("Unexpected extra positional input; quote the complete text.");
  for (const [name, flag] of Object.entries(flags)) {
    if (
      (flag.type === "string" || flag.type === "positional") &&
      a[name] !== undefined &&
      !(["loom", "file", "dir", "url"].includes(name) && Array.isArray(a[name]))
    )
      value(a, name);
  }
  if (a.port !== undefined) integer(a, "port", 65535);
  if (a.limit !== undefined) integer(a, "limit", 200, 1);
  if (a.timeout !== undefined) integer(a, "timeout", 2147483647, 1);
  return a;
}
export const instanceFlag = { instance: str("Observed Service instance") };
export const admissionFlags = {
  ...instanceFlag,
  "operation-id": str("Original operation UUID"),
};
export const queryFlags = {
  loom: str("Loom filter"),
  stage: str("Stage filter"),
  limit: str("Page size 1–200"),
  cursor: str("Page cursor"),
};
export function query(a: Values) {
  return parseArtifactQuery({
    ...(a.loom ? { loomName: a.loom } : {}),
    ...(a.stage ? { stageName: a.stage } : {}),
    ...(a.limit ? { limit: integer(a, "limit", 200, 1) } : {}),
    ...(a.cursor ? { cursor: a.cursor } : {}),
  });
}
export const buildFlags = {
  path: pos("Loom source directory (defaults to current directory)", false),
};
export function normalizeArguments(rawArgs: readonly string[]) {
  const common: Record<string, unknown> = { interactive: true };
  const loomInputs: string[] = [];
  const pathInputs: { files?: string[]; dirs?: string[]; urls?: string[] } = {};
  const args: string[] = [];
  let literal = false;
  for (let index = 0; index < rawArgs.length; index++) {
    const raw = rawArgs[index];
    const item = literal ? raw : raw?.replace(/^-l(?:oom)?(?==|$)/u, "--loom");
    if (item === undefined) continue;
    if (item === "--") {
      literal = true;
      args.push(item);
      continue;
    }
    if (
      !literal &&
      /^--(?:to|scope|prompt|prompt-file|answer|answer-file|operation-id|instance|origin-instance|port|loom|stage|limit|cursor|output|mcp|ide|execution|until|timeout|revision|file|dir|url)(?:=|$)/u.test(
        item,
      )
    ) {
      const equals = item.indexOf("=");
      const argument =
        equals >= 0 ? item.slice(equals + 1) : rawArgs[index + 1];
      if (item === "--loom" || item.startsWith("--loom="))
        loomInputs.push(argument ?? "");
      const slot = /^--(file|dir|url)(?:=|$)/u.exec(item)?.[1];
      if (slot && rawArgs.includes("run")) {
        const key = `${slot}s` as "files" | "dirs" | "urls";
        pathInputs[key] ??= [];
        pathInputs[key].push(argument ?? "");
      }
      args.push(item);
      if (equals < 0 && argument !== undefined) {
        args.push(argument);
        index++;
      }
      continue;
    }
    const flag =
      /^--(no-)?(project|json|interactive|color|debug|info)(?:=(.*))?$/u.exec(
        item,
      );
    const key = flag?.[2];
    if (!literal && flag && key) {
      common[key] =
        key === "project"
          ? (flag[3] ?? rawArgs[++index])
          : !flag[1] && flag[3] !== "false";
    } else args.push(item);
  }

  return { common, loomInputs, pathInputs, args };
}
