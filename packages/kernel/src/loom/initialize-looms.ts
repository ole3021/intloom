import { getLogger } from "@intloom/utils";
import { join } from "node:path";
import { discoverLooms } from "./discover-looms.ts";
import { loomError } from "./errors.ts";
import { loadLoom } from "./load-loom.ts";
import { registerLooms } from "./register-looms.ts";
import type {
  LoadedAgent,
  InitializeLoomsOptions,
  LoomInitializationResult,
  LoomInitializationPhase,
  LoomInitializationOutcome,
} from "./types.ts";

/** Initializes each declared Loom independently, retaining per-package diagnostics. */
export async function initializeLooms(
  options: InitializeLoomsOptions,
): Promise<LoomInitializationResult> {
  const log = getLogger();
  log.debug("loom_discovery_started");
  const discovery = await discoverLooms(
    join(options.projectRoot, ".intloom/looms"),
    options.config.looms ?? [],
  );
  const results: LoomInitializationOutcome[] = [...discovery.failures];
  for (const failure of discovery.failures)
    log.error("loom_load_failed", {
      packageName: failure.packageName,
      phase: failure.phase,
      err: failure.error,
    });
  let registries = registerLooms([], []);

  for (const source of discovery.sources) {
    let phase: LoomInitializationPhase = "load";
    let loomName: string | undefined;
    try {
      log.debug("loom_load_started", { packageName: source.packageName });
      const loom = await loadLoom(source);
      loomName = loom.blueprint.loomName;

      // Registration publishes only a fully validated package; no model or credential is loaded here.
      phase = "agent";
      const agents: LoadedAgent[] = [];
      for (const [agentId, spec] of Object.entries(loom.agentSpecs)) {
        agents.push(Object.freeze({ agentId, spec, source }));
      }

      phase = "register";
      // Registration validates completeness and conflicts before returning new registries; conflicts preserve previously registered packages.
      registries = registerLooms([loom], agents, registries);
      results.push({
        packageName: source.packageName,
        loomName,
        isAvailable: true,
      });
      log.info("loom_ready", {
        packageName: source.packageName,
        loomName,
        agentCount: agents.length,
      });
    } catch (cause) {
      const code =
        phase === "agent"
          ? "LOOM_AGENT_FAILED"
          : phase === "register"
            ? "LOOM_REGISTRATION_FAILED"
            : "LOOM_LOAD_FAILED";
      log.error("loom_load_failed", {
        packageName: source.packageName,
        phase,
        err: loomError(cause, code, "Loom initialization failed."),
      });
      results.push({
        packageName: source.packageName,
        ...(loomName === undefined ? {} : { loomName }),
        isAvailable: false,
        phase,
        error: loomError(
          cause,
          code,
          `Cannot initialize Loom ${source.packageName} during ${phase}`,
        ),
      });
    }
  }
  return { registries, looms: results };
}
