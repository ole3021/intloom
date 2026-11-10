import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { parseArgs } from "node:util";
import { IntloomError, type LoomSelector, type Page } from "@intloom/loom-sdk";
import { createServiceClient } from "./service/client.ts";

export function commandContext(
  parsed: ReturnType<typeof parseArgs>,
  output: (value: unknown) => void,
  serviceDir = join(homedir(), ".intloom"),
  mcpPort?: number,
) {
  const positionals = parsed.positionals;
  const values = parsed.values;

  const string = (name: string) =>
    typeof values[name] === "string" ? (values[name] as string) : undefined;
  const [command, operation, argument] = positionals;

  const dataDir = serviceDir;
  const required = (value: string | undefined, message: string): string => {
    if (!value) throw new IntloomError("INVALID_ARGUMENT", message);
    return value;
  };
  const select = (value: string): LoomSelector => {
    if (/^[a-f0-9]{64}$/.test(value)) return { artifactDigest: value };
    const split = value.lastIndexOf("@");
    if (split < 1) return { id: value };
    if (split === value.length - 1)
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Use an artifact digest or id@version.",
      );
    return { id: value.slice(0, split), version: value.slice(split + 1) };
  };
  const count = (name: string) => {
    const value = string(name);
    if (value === undefined) return undefined;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0)
      throw new IntloomError(
        "INVALID_ARGUMENT",
        `${name} must be a nonnegative number.`,
      );
    return number;
  };
  const pagination = () => {
    const cursor = string("cursor"),
      limit = count("limit");
    return {
      ...(cursor === undefined ? {} : { cursor }),
      ...(limit === undefined ? {} : { limit }),
    };
  };
  const exact = (length: number) => {
    if (positionals.length !== length)
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Wrong number of command arguments.",
      );
  };
  const readJson = async (raw: string): Promise<unknown> => {
    let text = raw;
    if (raw === "@-") {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
      text = Buffer.concat(chunks).toString("utf8");
    } else if (raw.startsWith("@")) text = await readFile(raw.slice(1), "utf8");
    try {
      return JSON.parse(text);
    } catch {
      throw new IntloomError("INVALID_ARGUMENT", "Input must be JSON.");
    }
  };
  return {
    command,
    mcpPort: string("port") === undefined ? mcpPort : Number(string("port")),
    operation,
    argument,
    dataDir,
    values,
    plain: Boolean(values.plain),
    observation: {
      until: (string("until") ?? "waiting") as "waiting" | "terminal",
      timeoutMs:
        string("timeout") === undefined
          ? undefined
          : Number(string("timeout")) * 1000,
    },
    output,
    client: createServiceClient(dataDir, string("project") ?? process.cwd()),
    required,
    select,
    pagination,
    string,
    count,
    exact,
    readJson,
  };
}
export type CommandContext = ReturnType<typeof commandContext>;

export async function allItems<T>(
  query: (page: { limit: number; cursor?: string }) => Promise<Page<T>>,
) {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await query({ limit: 100, ...(cursor ? { cursor } : {}) });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}
