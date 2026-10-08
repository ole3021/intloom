import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseDocument } from "yaml";
import { loomConfigSchema } from "./schemas/loom-config.ts";
import type { LoomConfig } from "./schemas/loom-config.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";

/** Reads the fixed project configuration without searching parent directories, merging configuration, or decrypting environment files. */
export async function loadConfig(projectRoot: string): Promise<LoomConfig> {
  const file = resolve(projectRoot, "intloom.yaml");
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (cause) {
    const missing =
      cause instanceof Error && "code" in cause && cause.code === "ENOENT";
    throw KERNEL_ERRORS.wrap(
      missing ? "NOT_FOUND" : "KERNEL_UNAVAILABLE",
      cause,
      {
        message: `Cannot read project configuration: ${file}`,
      },
    );
  }
  try {
    const document = parseDocument(text, {
      uniqueKeys: true,
      version: "1.2",
      prettyErrors: false,
    });
    const error = document.errors[0] ?? document.warnings[0];
    if (error) throw error;
    const value: unknown = document.toJS({ maxAliasCount: 0 });
    const config = loomConfigSchema.parse(value);
    return {
      ...config,
      workflows: config.workflows ?? [],
      localStorage: config.localStorage ?? "file",
    };
  } catch (cause) {
    throw KERNEL_ERRORS.wrap("INVALID_REQUEST", cause, {
      message: `Invalid project configuration: ${file}. Check intent.apps, useMcpAgent, localStorage, and any supplied llms.default configuration.`,
    });
  }
}
