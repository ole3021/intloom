import { LoomError, getLogger } from "@intloom/utils";
import { realpath } from "node:fs/promises";
import { withBuildLock } from "./build/build-lock.ts";
import { resolve } from "node:path";
import { analyzeLoom } from "./analyze/analyze-loom.ts";
import { buildExportFiles } from "./build/build-export-files.ts";
import { fail } from "./errors.ts";
import { loadSources } from "./load/load-sources.ts";
import type { CompileOptions, CompileResult } from "./types.ts";

export async function compileLoom(
  options: CompileOptions,
): Promise<CompileResult> {
  const log = options.logger ?? getLogger();
  const started = performance.now();
  let phase = "load";
  log.info("compile_started");
  try {
    let root: string;
    try {
      root = await realpath(resolve(options.packageRoot));
    } catch (cause) {
      fail(
        "SOURCE_READ_FAILED",
        "Invalid packageRoot",
        { file: options.packageRoot },
        cause,
      );
    }
    const result = await withBuildLock(root, async () => {
      const sources = await loadSources({ ...options, packageRoot: root });
      log.debug("sources_loaded", { resourceCount: sources.resources.length });
      phase = "analyze";
      const loom = analyzeLoom(sources);
      for (const diagnostic of loom.diagnostics)
        log.warn("compile_diagnostic", { ...diagnostic });
      log.debug("loom_analyzed");
      phase = "build";
      await buildExportFiles(loom);
      return {
        packageRoot: sources.options.packageRoot,
        outputPath: resolve(sources.options.packageRoot, "dist"),
        packageName: loom.model.manifest.name,
        packageVersion: loom.model.manifest.version,
        loomName: loom.model.loomName,
        diagnostics: loom.diagnostics,
      };
    });
    log.info("compile_completed", {
      durationMs: Math.round(performance.now() - started),
    });
    return result;
  } catch (cause) {
    log.error("compile_failed", { phase, err: cause });
    if (LoomError.is(cause)) throw cause;
    fail("BUILD_FAILED", "Loom compilation failed", undefined, cause);
  }
}
