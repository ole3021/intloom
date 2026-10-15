import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { failDiagnostics, type CompilerDiagnostic } from "../diagnostics.ts";
import type { GeneratedEntry } from "./generate-entry.ts";

const run = promisify(execFile);
const require = createRequire(import.meta.url);

interface TypeScriptBuildOptions {
  readonly root: string;
  readonly config: string;
  readonly entry: string;
  readonly output: string;
  readonly destination: string;
  readonly generatedConfig: string;
  readonly generated: GeneratedEntry;
}

export async function compileTypeScript({
  root,
  config,
  entry,
  output,
  destination,
  generatedConfig,
  generated,
}: TypeScriptBuildOptions): Promise<void> {
  await writeFile(
    generatedConfig,
    JSON.stringify(
      {
        extends: config,
        compilerOptions: {
          strict: true,
          strictFunctionTypes: true,
          strictNullChecks: true,
          noImplicitAny: true,
          noCheck: false,
          stripInternal: false,
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
        include: [],
        references: [],
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
    const diagnostics: CompilerDiagnostic[] = [];
    for (const block of detail.split(/(?=^[^\n]+\(\d+,\d+\): error TS)/m)) {
      const match = /^(.+)\((\d+),(\d+)\): error (TS\d+): ([\s\S]*)/.exec(
        block.trim(),
      );
      if (!match?.[1]) continue;
      const file = resolve(root, match[1]);
      const line = Number(match[2]);
      const origin = file === entry ? generated.locations[line] : undefined;
      diagnostics.push({
        severity: "error",
        code: "TYPESCRIPT_FAILED",
        message: `TypeScript compilation failed: ${match[4]}: ${match[5]?.trim()}${origin ? ` (resource: ${origin.resource.file})` : ""}`,
        location:
          origin?.location ??
          (file === entry
            ? { file: resolve(root, "package.json") }
            : { file, line, column: Number(match[3]) }),
        ...(origin ? { related: [origin.resource] } : {}),
      });
    }
    const located = diagnostics.some((d) => d.related)
      ? diagnostics.filter(
          (d) =>
            d.related || d.location?.file !== resolve(root, "package.json"),
        )
      : diagnostics;
    failDiagnostics(
      "TYPESCRIPT_FAILED",
      located.length
        ? located
        : [
            {
              severity: "error",
              code: "TYPESCRIPT_FAILED",
              message: `TypeScript compilation failed\n${detail}`,
              location: { file: config },
            },
          ],
      cause,
    );
  }
}
