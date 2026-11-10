import { dirname, join } from "node:path";
import { locateNpmLoom, npmRoot } from "@intloom/kernel";
import { IntloomError } from "@intloom/loom-sdk";
import type { CommandContext } from "../context.ts";
export async function selectNpmCommand(
  ctx: CommandContext,
  name: string,
  command?: string,
) {
  const globalRoot = await npmRoot(true);
  const found = await locateNpmLoom(name, globalRoot, process.cwd());
  if (!found) return undefined;
  const { manifest } = found;
  const defaultCommand =
    manifest.defaultCommand ?? Object.keys(manifest.commands)[0];
  if (!defaultCommand)
    throw new IntloomError(
      "PACKAGE_INCOMPATIBLE",
      "Expected at least one Loom command.",
    );
  if (
    !command &&
    !["input", "paths", "files", "prompt"].some(
      (key) => ctx.string(key) !== undefined,
    )
  ) {
    ctx.output({
      name: found.name,
      version: found.version,
      defaultCommand,
      commands: manifest.commands,
      usage: Object.keys(manifest.commands).map(
        (command) => `intloom run ${found.name} ${command} --input @input.json`,
      ),
      ...(manifest.examples ? { examples: manifest.examples } : {}),
    });
    return { help: true as const };
  }
  const selected = command ?? defaultCommand;
  const entry = manifest.commands[selected];
  if (!entry)
    throw new IntloomError("INVALID_ARGUMENT", `Unknown command: ${selected}`);
  const ref = await ctx.client("installLoom", [
    {
      source: dirname(join(found.directory, entry.entry)),
      installedDirectory: true,
      snapshotOnly: !found.global || selected !== defaultCommand,
    },
  ]);
  return { ref, input: entry.input };
}
