import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fail } from "../errors.ts";

const run = promisify(execFile);
const require = createRequire(import.meta.url);

interface TypeScriptBuildOptions {
  readonly root: string;
  readonly config: string;
  readonly entry: string;
  readonly output: string;
  readonly destination: string;
  readonly generatedConfig: string;
}

export async function compileTypeScript({
  root,
  config,
  entry,
  output,
  destination,
  generatedConfig,
}: TypeScriptBuildOptions): Promise<void> {
  await writeFile(
    generatedConfig,
    JSON.stringify(
      {
        extends: config,
        compilerOptions: {
          target: "ES2023",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          rootDir: root,
          outDir: output,
          declarationDir: output,
          noEmit: false,
          noEmitOnError: true,
          emitDeclarationOnly: false,
          declaration: true,
          declarationMap: false,
          sourceMap: true,
          inlineSourceMap: false,
          inlineSources: true,
          sourceRoot: "",
          mapRoot: "",
          rewriteRelativeImportExtensions: true,
          incremental: false,
          composite: false,
        },
        files: [entry],
        exclude: [
          resolve(root, "**/*.spec.ts"),
          resolve(root, "**/*.intg.ts"),
          resolve(root, "test"),
          destination,
          resolve(root, ".intloom-build-*"),
        ],
      },
      null,
      2,
    ),
  );
  const tsc = resolve(
    dirname(require.resolve("typescript/package.json")),
    "bin/tsc",
  );
  try {
    await run(
      process.execPath,
      [tsc, "-p", generatedConfig, "--pretty", "false"],
      { cwd: root, maxBuffer: 10 * 1024 * 1024 },
    );
  } catch (cause) {
    const detail =
      cause && typeof cause === "object" && "stdout" in cause
        ? String(cause.stdout)
        : "";
    fail(
      "TYPESCRIPT_FAILED",
      `TypeScript compilation failed\n${detail}`,
      { file: config },
      cause,
    );
  }
}
