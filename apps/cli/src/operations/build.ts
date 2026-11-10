import { existsSync } from "node:fs";
import { readFile, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  IntloomError,
  type LoomCatalogEntry,
  type InstalledLoomRef,
} from "@intloom/loom-sdk";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { CommandContext } from "../context.ts";
import { ensureService } from "../service/process.ts";

export function archiveFilename(id: string, version: string) {
  return `${id.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}
export async function buildArchive(
  ctx: Pick<
    CommandContext,
    "dataDir" | "plain" | "client" | "string" | "mcpPort"
  >,
  options: {
    directory?: string | undefined;
    update?: boolean;
  } = {},
) {
  const started = Date.now();
  const entryFile = resolve(ctx.string("project") ?? ".", "loom.ts");
  const projectDir = dirname(entryFile);
  const require = createRequire(join(projectDir, "package.json"));
  const projectCompiler = require.resolve
    .paths("@intloom/compiler")
    ?.find((path) => existsSync(join(path, "@intloom/compiler/package.json")));
  const compiler = projectCompiler
    ? ((await import(
        pathToFileURL(require.resolve("@intloom/compiler")).href
      )) as typeof import("@intloom/compiler"))
    : await import("@intloom/compiler");
  const { compileLoom, packLoom } = compiler;
  let catalog: readonly LoomCatalogEntry[] = [];
  const loadCatalog = async (locked?: readonly InstalledLoomRef[]) => {
    await ensureService(ctx.dataDir, !ctx.plain, ctx.mcpPort);
    catalog = await ctx.client("getLoomCatalog", locked ? [locked] : []);
    return catalog;
  };
  const temporary = await mkdtemp(join(tmpdir(), "intloom-build-"));
  try {
    const compiled = await compileLoom({
      entryFile,
      outDir: join(temporary, "compiled"),
      catalog: loadCatalog,
      update: Boolean(options.update),
    });
    if (!compiled.ok) {
      const diagnostics = compiled.diagnostics.map(
        ({ stage, code, message, path, componentId }) => ({
          stage,
          code,
          message,
          ...(path ? { path } : {}),
          ...(componentId ? { componentId } : {}),
        }),
      );
      throw new IntloomError("INPUT_INVALID", "Loom compilation failed.", {
        diagnostics,
      });
    }
    {
      const pkg = JSON.parse(
        await readFile(join(projectDir, "package.json"), "utf8"),
      );
      if (pkg.version !== compiled.manifest.version)
        throw new IntloomError(
          "INVALID_ARGUMENT",
          `dev build needs matching versions to locate the test and publish archive. Loom: ${compiled.manifest.version}; package.json: ${pkg.version ?? "(missing)"}.`,
        );
    }
    const filename = archiveFilename(
      compiled.manifest.id,
      compiled.manifest.version,
    );
    const archive = await packLoom({
      artifactDir: compiled.artifactDir,
      outFile: join(resolve(projectDir, options.directory ?? "dist"), filename),
      dependencySources: catalog,
    });
    return {
      ...archive,
      target: compiled.manifest.build.target,
      elapsedMs: Date.now() - started,
      size: (await stat(archive.archiveFile)).size,
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
