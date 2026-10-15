import type { LoomError } from "@intloom/utils";
import type { LoomConfig } from "../core/schemas/loom-config.ts";
import type { AgentId } from "./blueprint.ts";
import type { AgentSpec, LoomModule } from "./module.ts";
import type { LoomRegistries } from "./registries.ts";

export interface LoomPackage {
  readonly packageName: string;
  readonly packageVersion: string;
  /** The loom.version field in package.json, managed independently of the npm package version. */
  readonly protocolVersion: string;
  readonly protectedFiles?: readonly string[];
  readonly packageRoot: string;
  /** Absolute file URL resolved through package exports, used for import. */
  readonly entryUrl: string;
  /** Absolute directory containing the generated entry; typically dist locally and the package root after installation. */
  readonly assetRoot: string;
}

export interface LoadedLoom extends LoomModule {
  readonly source: LoomPackage;
}

export interface InitializeLoomsOptions {
  readonly projectRoot: string;
  /** Validated by the configuration loader; the Loom module does not reload configuration files. */
  readonly config: LoomConfig;
}

/** Validated resources, independent of model configuration and credentials. */
export interface LoadedAgent {
  readonly agentId: AgentId;
  readonly spec: AgentSpec;
  readonly source: LoomPackage;
}

export type LoomInitializationPhase =
  | "discover"
  | "load"
  | "agent"
  | "register";

/** loomName may be unavailable before loading; failures are always recorded by dependency package name. */
export interface LoomInitializationFailure {
  readonly packageName: string;
  readonly loomName?: string;
  readonly isAvailable: false;
  readonly phase: LoomInitializationPhase;
  readonly error: LoomError;
}

export type LoomInitializationOutcome =
  | {
      readonly packageName: string;
      readonly loomName: string;
      readonly isAvailable: true;
    }
  | LoomInitializationFailure;

export interface LoomDiscoveryResult {
  readonly sources: readonly LoomPackage[];
  readonly failures: readonly LoomInitializationFailure[];
}

export interface LoomInitializationResult {
  /** Contains only fully initialized Looms; failed packages contribute no registered resources. */
  readonly registries: LoomRegistries;
  readonly looms: readonly LoomInitializationOutcome[];
}
