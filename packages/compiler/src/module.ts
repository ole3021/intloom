import type { LoomManifest } from "@intloom/loom-sdk";
import { authorFiles } from "./author-files.ts";
import { execFile } from "node:child_process";
import { builtinModules, createRequire } from "node:module";
import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PackageError } from "@intloom/loom-sdk/package-format";
import { build } from "esbuild";

const exec = promisify(execFile);
export async function checkTypes(
  entry: string,
  temporary: string,
): Promise<void> {
  const projectConfig = join(dirname(entry), "tsconfig.json");
  const hasConfig = await access(projectConfig).then(
    () => true,
    () => false,
  );
  const config = join(temporary, "tsconfig.json");
  const configuration = {
    ...(hasConfig ? { extends: projectConfig } : {}),
    compilerOptions: {
      noEmit: true,
      noCheck: false,
      declaration: false,
      composite: false,
      incremental: false,
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      target: "ES2022",
      lib: ["ES2022", "DOM"],
      module: "ESNext",
      moduleResolution: "Bundler",
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      ...(hasConfig ? {} : { types: [] }),
    },
    files: [entry],
    include: [],
  };
  await writeFile(config, JSON.stringify(configuration));
  const cli = join(
    dirname(createRequire(import.meta.url).resolve("typescript/package.json")),
    "bin/tsc",
  );
  try {
    if (hasConfig) {
      const shown = await exec(
        process.execPath,
        [cli, "-p", config, "--showConfig"],
        {
          maxBuffer: 4 * 1024 * 1024,
        },
      );
      const effective = JSON.parse(shown.stdout) as {
        compilerOptions?: { typeRoots?: string[] };
      };
      if (effective.compilerOptions?.typeRoots === undefined) {
        // TypeScript otherwise searches from the generated config in tmpdir.
        const typeRoots: string[] = [];
        for (let directory = dirname(entry); ; directory = dirname(directory)) {
          typeRoots.push(join(directory, "node_modules/@types"));
          if (dirname(directory) === directory) break;
        }
        await writeFile(
          config,
          JSON.stringify({
            ...configuration,
            compilerOptions: { ...configuration.compilerOptions, typeRoots },
          }),
        );
      }
    }
    await exec(process.execPath, [cli, "-p", config, "--pretty", "false"], {
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    throw new PackageError(
      "TYPECHECK_FAILED",
      (error as { stdout?: string }).stdout || String(error),
    );
  }
}
export async function bundleModule(
  entry: string,
  outfile: string,
  target: LoomManifest["build"]["target"],
): Promise<void> {
  const builtins = new Set(
    builtinModules.flatMap((name) => [name, `node:${name}`]),
  );
  await build({
    entryPoints: [entry],
    outfile,
    absWorkingDir: dirname(entry),
    bundle: true,
    platform: "node",
    format: "esm",
    target,
    metafile: true,
    logLevel: "silent",
    legalComments: "none",
    minifyWhitespace: true,
    banner: {
      js: 'import { createRequire as __intloomRequire } from "node:module"; const require = __intloomRequire(import.meta.url);',
    },
    logOverride: {
      "unsupported-dynamic-import": "error",
      "unsupported-require-call": "error",
      "require-resolve-not-external": "error",
      "empty-glob": "error",
    },
    plugins: [
      authorFiles(dirname(entry)),
      {
        name: "loom-module-boundary",
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) => {
            if (
              /^@mastra\//.test(args.path) ||
              /^@intloom\/(compiler|kernel|mastra)(\/|$)/.test(args.path) ||
              /^@intloom\/loom-sdk\//.test(args.path) ||
              /\.node$/.test(args.path)
            )
              return {
                errors: [{ text: `Unsupported author module: ${args.path}` }],
              };
            if (args.path === "module" || args.path === "node:module")
              return {
                errors: [
                  {
                    text: "Runtime module loaders cannot form a closed Loom artifact.",
                  },
                ],
              };
            if (builtins.has(args.path))
              return { path: args.path, external: true };
            return undefined;
          });
        },
      },
    ],
  }).then((result) => {
    for (const output of Object.values(result.metafile.outputs))
      for (const imported of output.imports)
        if (imported.external && !builtins.has(imported.path))
          throw new PackageError(
            "MODULE_UNSUPPORTED",
            `Unbundled import: ${imported.path}`,
          );
  });
}
export async function inspectModule(
  module: string,
  resultFile: string,
  target: LoomManifest["build"]["target"],
): Promise<unknown> {
  await exec(
    process.execPath,
    [
      fileURLToPath(new URL("./inspect-worker.js", import.meta.url)),
      module,
      resultFile,
      target,
    ],
    { timeout: 30_000, maxBuffer: 1024 * 1024 },
  );
  const response = JSON.parse(await readFile(resultFile, "utf8")) as {
    ok: boolean;
    result?: unknown;
    code?: string;
    message?: string;
    path?: string;
  };
  if (!response.ok)
    throw Object.assign(
      new PackageError(
        response.code ?? "DEFINITION_INVALID",
        response.message ?? "Definition inspection failed.",
      ),
      response.path ? { path: response.path } : {},
    );
  return response.result;
}
