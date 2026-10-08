import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  distributionManifest,
  writeJson,
} from "../../../scripts/publication.ts";

async function prepareCliPackage(root: string): Promise<void> {
  const destination = resolve(root, ".publish");
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination);
  const manifest = await distributionManifest(root);
  if (manifest.bundleDependencies?.join() !== "@intloom/kernel")
    throw new Error("CLI must bundle only the private Kernel package.");
  for (const file of ["dist", "README.md", "LICENSE"])
    await cp(resolve(root, file), resolve(destination, file), {
      recursive: true,
    });
  const kernelFile = findPackageJSON(
    "@intloom/kernel",
    pathToFileURL(resolve(root, "package.json")),
  );
  if (!kernelFile) throw new Error("Kernel is not built/installed.");
  const kernelRoot = dirname(kernelFile);
  const kernel = await distributionManifest(kernelRoot);
  if (kernel.private !== true) throw new Error("Kernel must remain private.");
  // The archive carries Kernel files only. npm treats bundled subtrees as supplied,
  // so expose their external dependencies on CLI rather than silently omitting them.
  const dependencies = { ...manifest.dependencies };
  for (const [name, range] of Object.entries(kernel.dependencies ?? {})) {
    if (dependencies[name] && dependencies[name] !== range)
      throw new Error(`CLI/Kernel dependency conflict: ${name}`);
    dependencies[name] = range;
  }
  manifest.dependencies = dependencies;
  // Kernel is embedded rather than independently installed. Its runtime
  // dependencies are installed by the CLI, so leaving them here makes npm
  // treat them as missing bundled subtrees during a global install.
  delete kernel.dependencies;
  delete kernel.peerDependencies;
  delete kernel.optionalDependencies;
  const bundled = resolve(destination, "node_modules/@intloom/kernel");
  await mkdir(bundled, { recursive: true });
  for (const file of ["dist", "migrations", "README.md", "LICENSE"])
    await cp(resolve(kernelRoot, file), resolve(bundled, file), {
      recursive: true,
    });
  await writeJson(resolve(bundled, "package.json"), kernel);
  await writeJson(resolve(destination, "package.json"), manifest);
  const launcher = resolve(root, ".publish-intloom");
  await rm(launcher, { recursive: true, force: true });
  await mkdir(resolve(launcher, "dist"), { recursive: true });
  const entry = {
    name: "intloom",
    version: manifest.version,
    description: "IntLoom command-line entry backed by @intloom/cli",
    type: "module",
    bin: { intloom: "./dist/bin.js" },
    files: ["dist", "README.md", "LICENSE"],
    dependencies: { "@intloom/cli": manifest.version },
    engines: manifest.engines,
    license: manifest.license,
    repository: manifest.repository,
    homepage: manifest.homepage,
    bugs: manifest.bugs,
    publishConfig: manifest.publishConfig,
  };
  await writeJson(resolve(launcher, "package.json"), entry);
  // Import the real bin in this process so arguments, streams, signals, and color setup are identical.
  await writeFile(
    resolve(launcher, "dist/bin.js"),
    '#!/usr/bin/env node\nimport "@intloom/cli/bin";\n',
    { mode: 0o755 },
  );
  await writeFile(
    resolve(launcher, "README.md"),
    "# IntLoom\n\nInstall with `npm install -g intloom` and run `intloom --help`.\n\nThis entry depends on the exact same version of `@intloom/cli`; both install options provide the same command. Install either package.\n",
  );
  await cp(resolve(root, "LICENSE"), resolve(launcher, "LICENSE"));
}

await prepareCliPackage(fileURLToPath(new URL("../", import.meta.url)));
