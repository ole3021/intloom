import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openKernel } from "../../dist/index.js";
import { prepared } from "./data.mjs";

export async function runtimeFixture(t, options = {}) {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "intloom-runtime-")),
  );
  const dataDir = join(root, "data");
  const directory = await prepared(root);
  const manifest = JSON.parse(
    await readFile(join(directory, "loom.json"), "utf8"),
  );
  manifest.execution.scope = options.scope ?? "intloom";
  manifest.output = options.output ?? {};
  manifest.input = options.input ?? {};
  await writeFile(join(directory, "loom.json"), JSON.stringify(manifest));
  await writeFile(
    join(directory, "main.js"),
    `
    import { z } from ${JSON.stringify(import.meta.resolve("zod"))};
    import { withTempDir } from ${JSON.stringify(import.meta.resolve("@intloom/loom-sdk"))};
    ${options.source ?? "export default async function main() {}"}
  `,
  );
  const kernel = await openKernel({ dataDir, ...options.runtime });
  t.after(async () => {
    try {
      await kernel.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  const installation = await kernel.registerInstallation({
    directory,
    packagePath: ".",
  });
  const workspace = join(root, "workspace");
  await mkdir(workspace);
  return {
    root,
    dataDir,
    kernel,
    installation,
    workspace,
    start: (input = {}) =>
      kernel.startRun({
        package: installation.package,
        input,
        ...(options.scope === "workspace" ? { workDir: workspace } : {}),
      }),
  };
}

export async function interaction(
  kernel,
  runId,
  cursor,
  predicate = () => true,
) {
  for await (const event of kernel.observeRun(runId, {
    ...(cursor ? { cursor } : {}),
    signal: AbortSignal.timeout(10_000),
  })) {
    if (
      event.type === "interaction" &&
      ["pending", "deferred"].includes(event.data.status) &&
      predicate(event.data)
    )
      return event;
  }
  throw new Error("Run ended before the expected interaction");
}

if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv[2] === "host"
) {
  const kernel = await openKernel({ dataDir: process.argv[3] });
  const { runId } = await kernel.startRun({
    package: JSON.parse(process.argv[4]),
    input: {},
  });
  const question = await interaction(kernel, runId);
  process.send({
    runId,
    cursor: question.cursor,
    record: await kernel.getRun(runId),
  });
  await new Promise(() => {});
}
