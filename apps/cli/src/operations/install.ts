import { progress } from "../ui/live.ts";
import { statSync } from "node:fs";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { IntloomError } from "@intloom/loom-sdk";
import { createPackageStore } from "@intloom/kernel";
import type { CommandContext } from "../context.ts";

export const npmExec = promisify(execFile);

export async function installSource(
  ctx: CommandContext,
  source: string,
  options: { snapshotOnly?: boolean; registryOnly?: boolean } = {},
) {
  let expected: { id: string; version?: string } | undefined;
  let temp: string | undefined;
  try {
    let path = resolve(source);
    if (options.registryOnly || !statSync(path, { throwIfNoEntry: false })) {
      // Only a registry package name with an optional exact version may trigger a download.
      const match =
        /^((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)(?:@(\d+\.\d+\.\d+(?:[-+][0-9a-zA-Z.+-]+)?))?$/.exec(
          source,
        );
      if (!match?.[1] || source.endsWith(".tgz"))
        throw new IntloomError(
          "INVALID_ARGUMENT",
          `Archive not found or invalid npm package: ${source}`,
        );
      temp = await mkdtemp(join(tmpdir(), "intloom-npm-"));
      const display = progress(
        `Downloading ${source} from npm`,
        "working",
        !ctx.plain,
      );
      try {
        const { stdout } = await npmExec("npm", [
          "pack",
          source,
          "--json",
          "--ignore-scripts",
          "--pack-destination",
          temp,
        ]).catch(() => {
          throw new IntloomError(
            "LOOM_NOT_FOUND",
            `Could not download ${source} from the configured npm registry.`,
          );
        });
        const [{ filename }] = JSON.parse(stdout);
        path = join(temp, filename);
        expected = { id: match[1], ...(match[2] && { version: match[2] }) };
      } finally {
        display.close();
      }
    }
    const deps = ctx.values.dependency as string[] | undefined;
    const install = {
      source: path,
      ...(deps && { dependencySources: deps.map((d) => resolve(d)) }),
      ...(options.snapshotOnly && { snapshotOnly: true }),
      ...(expected && { expected }),
    };
    try {
      return await ctx.client("installLoom", [install]);
    } catch (error) {
      if (
        !(error instanceof IntloomError) ||
        error.code !== "SERVICE_NOT_RUNNING"
      )
        throw error;
      const store = await createPackageStore({ dataDir: ctx.dataDir });
      try {
        return await store.installLoom(install);
      } finally {
        await store.close();
      }
    }
  } finally {
    if (temp) await rm(temp, { recursive: true, force: true });
  }
}
