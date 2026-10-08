import { LoomError, getLogger } from "@intloom/utils";
import { analyzeWorkflow } from "./analyze/analyze-workflow.ts";
import { buildExportFiles } from "./build/build-export-files.ts";
import { fail } from "./errors.ts";
import { loadSources } from "./load/load-sources.ts";
import type { CompileOptions } from "./types.ts";

export async function compileWorkflow(options: CompileOptions): Promise<void> {
  const log = options.logger ?? getLogger();
  const started = performance.now();
  let phase = "load";
  log.info("compile_started");
  try {
    const sources = await loadSources(options);
    log.debug("sources_loaded", { resourceCount: sources.resources.length });
    phase = "analyze";
    const workflow = await analyzeWorkflow(sources);
    log.debug("workflow_analyzed");
    phase = "build";
    await buildExportFiles(workflow);
    log.info("compile_completed", {
      durationMs: Math.round(performance.now() - started),
    });
  } catch (cause) {
    log.error("compile_failed", { phase, err: cause });
    if (LoomError.is(cause)) throw cause;
    fail("BUILD_FAILED", "Workflow compilation failed", undefined, cause);
  }
}
