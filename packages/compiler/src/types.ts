import type {
  InstalledLoomRef,
  LoomCatalogEntry,
  LoomDependencyDeclaration,
  LoomManifest,
} from "@intloom/loom-sdk";

export interface CompileDiagnostic {
  readonly stage:
    | "typecheck"
    | "module"
    | "definition"
    | "schema"
    | "resources"
    | "dependencies"
    | "artifact";
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly componentId?: string;
}
export interface CompileOptions {
  readonly entryFile: string;
  readonly outDir: string;
  /** @deprecated Package identity comes from the Loom ID. A different name is rejected. */
  readonly npmName?: string;
  readonly target?: LoomManifest["build"]["target"];
  readonly catalog?: ResolveLoomDependenciesOptions["catalog"];
  readonly update?: boolean;
  /** Optional snapshot from a prior explicit resolve; it must match the project lock. */
  readonly dependencies?: ResolvedLoomDependencies;
}
export type CompileResult =
  | {
      readonly ok: true;
      readonly artifactDir: string;
      readonly manifest: LoomManifest;
      readonly artifactDigest: string;
      readonly diagnostics: readonly CompileDiagnostic[];
    }
  | { readonly ok: false; readonly diagnostics: readonly CompileDiagnostic[] };
export interface LoomLock {
  readonly formatVersion: 1;
  readonly declarations: LoomDependencyDeclaration;
  readonly dependencies: Readonly<Record<string, InstalledLoomRef>>;
  readonly packages: readonly {
    readonly ref: InstalledLoomRef;
    readonly dependencies: Readonly<Record<string, InstalledLoomRef>>;
  }[];
}
export interface ResolveLoomDependenciesOptions {
  readonly projectDir: string;
  readonly catalog:
    | readonly LoomCatalogEntry[]
    | ((
        locked?: readonly InstalledLoomRef[],
      ) => Promise<readonly LoomCatalogEntry[]>);
  readonly update?: boolean;
  /** Explicit digest selection for an otherwise ambiguous alias. */
  readonly selections?: Readonly<Record<string, string>>;
}
export interface ResolvedLoomDependencies {
  readonly lock: LoomLock;
  readonly lockFile: string;
  readonly referencesFile: string;
  readonly catalog: readonly LoomCatalogEntry[];
}
export interface PackLoomOptions {
  readonly artifactDir: string;
  readonly dependencySources?: readonly (
    | string
    | Pick<LoomCatalogEntry, "ref" | "artifactDir">
  )[];
  readonly outFile: string;
}
export interface PackLoomResult {
  readonly archiveFile: string;
  readonly root: InstalledLoomRef;
}
