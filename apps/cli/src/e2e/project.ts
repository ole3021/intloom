import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { parseDocument } from "yaml";
import { loomViewSchema } from "@intloom/kernel/host";
import {
  E2eError,
  type Configuration,
  type Models,
  type Entry,
} from "./contracts.ts";
import type { CaseData } from "./cases.ts";
import type { CmdDriver } from "./drivers/cmd.ts";

export async function prepareProject(
  cmd: CmdDriver,
  archive: string,
  data: CaseData,
  config: Configuration,
  models: Models,
  entry: Entry,
  signal: AbortSignal,
  preparation: () => Promise<void>,
) {
  await cmd.call(["init", cmd.project], signal);
  for (const file of data.files.filter((f) =>
    f.path.startsWith(`workspace${sep}`),
  )) {
    const destination = join(
      cmd.project,
      file.path.slice("workspace".length + 1),
    );
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(data.directory, file.path), destination, 1);
  }
  await cmd.call(["loom", "add", archive], signal);
  const filename = join(cmd.project, "intloom.yaml");
  const document = parseDocument(await readFile(filename, "utf8"));
  document.set("localStorage", config.storage);
  document.set("useMcpAgent", true);
  document.set("mirror", { enabled: true });
  if (entry === "cmd")
    document.set(
      "llms",
      document.createNode(models.service ?? { default: models.user }, {
        aliasDuplicateObjects: false,
      }),
    );
  await writeFile(filename, document.toString(), { mode: 0o600 });
  if (config.limits.maxAgentSteps !== undefined)
    await writeFile(
      join(cmd.project, "intloom/host.json"),
      JSON.stringify({ maxAgentSteps: config.limits.maxAgentSteps }),
      { flag: "wx" },
    );
  await cmd.evidence.event("configuration", { configuration: document.toJS() });
  await preparation();
  await cmd.call(["start"], signal);
  await cmd.call(
    ["doctor", "--execution", entry === "cmd" ? "cli" : "agent_ide"],
    signal,
  );
  const installed = await cmd.call(["loom", "list"], signal);
  // The list command includes package installation details; the service catalog is authoritative for inputs.
  await cmd.evidence.event("loom_installed", { installed });
}

export function availableLoom(value: unknown, packageName: string) {
  const parsed = loomViewSchema.array().parse(value);
  const loom = parsed.find((l) => l.packageName === packageName);
  if (!loom?.isAvailable)
    throw new E2eError(
      "LOOM_UNAVAILABLE",
      "The installed built Loom is unavailable. Inspect its loader diagnostics.",
      "system",
    );
  return loom;
}
