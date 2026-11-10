import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";
import { parse, stringify } from "yaml";
import {
  assertPackagePath,
  authorManifest,
  createIntegrity,
  nodeRequirements,
} from "@intloom/loom-sdk/package-format";
import { authorFiles } from "./author-files.ts";
import { inspectModule } from "./module.ts";
import type { Inspection } from "./inspect.ts";

const exec = promisify(execFile);

/** Compile the command modules on the author's machine and pack one installable npm package. */
export async function buildPackage(directory: string, destination: string) {
  const root = resolve(directory);
  const output = resolve(destination);
  const metadata = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const manifest = authorManifest.parse(
    parse(await readFile(join(root, "loom.yaml"), "utf8")),
  );
  await mkdir(output, { recursive: true });
  // This location also lets Node resolve author-installed npm dependencies during inspection.
  const staging = await mkdtemp(join(root, ".loom-build-"));
  try {
    for (const [name, command] of Object.entries(manifest.commands)) {
      const dir = join(staging, "commands", name);
      await mkdir(dir, { recursive: true });
      const module = join(dir, "runtime.mjs");
      const header = {
        kind: "loom",
        id: metadata.name,
        version: metadata.version,
        name: manifest.name,
        description: command.description,
      };
      const source = [
        `import entry from ${JSON.stringify(`./${command.entry}`)};`,
        `export default {...${JSON.stringify(header)},entry};`,
        ...(manifest.check
          ? [
              "export {default as check} from " +
                JSON.stringify(`./${manifest.check}`) +
                ";",
            ]
          : []),
      ].join("\n");
      await build({
        stdin: { contents: source, resolveDir: root },
        outfile: module,
        bundle: true,
        plugins: [authorFiles(root)],
        platform: "node",
        format: "esm",
        target: "node22",
        external: Object.keys(metadata.dependencies ?? {}),
        logLevel: "silent",
      });
      const inspection = (await inspectModule(
        module,
        join(staging, "inspection.json"),
        "node22",
      )) as Inspection;
      for (const slot of Object.keys(inspection.manifest.requirements.models)) {
        if (!manifest.models?.[slot])
          throw new Error(`Missing loom.yaml model requirement: ${slot}`);
      }
      const files = new Map<string, Uint8Array>();
      const resources: Record<string, { path: string }> = Object.create(null);
      for (const [id, file] of Object.entries(inspection.resourcePaths)) {
        assertPackagePath(file);
        const target =
          inspection.manifest.resources[id]?.path ??
          `resources/${id}/${file.split("/").at(-1)}`;
        resources[id] = { path: target };
        const bytes = await readFile(join(root, file));
        await mkdir(dirname(join(dir, target)), { recursive: true });
        await writeFile(join(dir, target), bytes);
        files.set(target, bytes);
      }
      const internal = { ...inspection.manifest, resources, dependencies: {} };
      const pkg = {
        name: metadata.name,
        version: metadata.version,
        type: "module",
        engines: { node: nodeRequirements.node22 },
      };
      for (const [file, content] of Object.entries({
        "package.json": pkg,
        "loom.json": internal,
      })) {
        const bytes = Buffer.from(JSON.stringify(content));
        await writeFile(join(dir, file), bytes);
        files.set(file, bytes);
      }
      files.set("runtime.mjs", await readFile(module));
      // The command contract is part of the installed command's identity.
      const contract = Buffer.from(
        JSON.stringify({
          name,
          input: command.input,
          output: command.output,
          models: manifest.models ?? {},
        }),
      );
      files.set("command.json", contract);
      await writeFile(join(dir, "command.json"), contract);
      await writeFile(
        join(dir, "integrity.json"),
        JSON.stringify(await createIntegrity(files)),
      );
      command.entry = `commands/${name}/runtime.mjs`;
    }
    const [firstCommand] = Object.values(manifest.commands);
    if (manifest.check && firstCommand) {
      // Each runtime exports the same preflight; a concrete entry remains discoverable in the package.
      manifest.check = `${firstCommand.entry}#check`;
    }
    await writeFile(join(staging, "loom.yaml"), stringify(manifest));
    await writeFile(
      join(staging, "package.json"),
      JSON.stringify(
        {
          name: metadata.name,
          version: metadata.version,
          description: manifest.description,
          type: "module",
          license: metadata.license,
          dependencies: metadata.dependencies,
          engines: { node: nodeRequirements.node22 },
          files: ["loom.yaml", "commands"],
        },
        null,
        2,
      ),
    );
    const { stdout } = await exec(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", output],
      { cwd: staging },
    );
    return join(output, JSON.parse(stdout)[0].filename);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
