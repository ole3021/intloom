import { defineCommand } from "citty";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CmdContext } from "../context.ts";
import { str, value } from "../arguments.ts";
export function createConfigurationCommands(context: CmdContext) {
  const { core, io, print, leaf } = context;
  return {
    config: defineCommand({
      meta: { description: "Startup configuration" },
      subCommands: {
        show: leaf("Safe configuration projection", {}, async (_a, p) =>
          print(await core.readProjectConfig(p)),
        ),
        set: leaf(
          "Write configuration against observed revision",
          { file: str("UTF-8 file"), revision: str("Revision from show") },
          async (a, p) =>
            print(
              await core.updateProjectConfig({
                ...p,
                configuration: await readFile(
                  resolve(io.cwd, value(a, "file", true)),
                  "utf8",
                ),
                revision: value(a, "revision", true),
              }),
            ),
        ),
        codex: leaf("Preview Codex MCP configuration", {}, async (_a, p) =>
          print(await core.planMcpConfig({ ...p, ide: "codex" })),
        ),
      },
    }),
  };
}
