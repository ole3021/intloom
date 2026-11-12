import type {
  InstalledLoom,
  InstalledLoomRef,
  ListRunsOptions,
  LoomCatalogEntry,
  LoomSelector,
  LoomSummary,
  Page,
  PageOptions,
  RunControlReceipt,
  RunResult,
  RunView,
  RunSummary,
  RunEventPage,
  RunEventsCommitted,
  RunActivityView,
  RuntimeBindings,
  ResumeRunOptions,
  InteractionRequest,
  InteractionResponse,
  InteractionResponseRecord,
  InteractionReceipt,
  ResponseSource,
  ArtifactRecord,
  ArtifactRead,
  AcceptanceRecord,
  StorageIssue,
} from "@intloom/loom-sdk";
export interface ServeOptions {
  /** Continue eligible saved operations during a service upgrade. */
  readonly recoverUpgrade?: boolean;
  readonly onRunEvents?: (notice: RunEventsCommitted) => void;
  readonly projectDir?: string;
  readonly dataDir: string;
  readonly bindings?: Pick<RuntimeBindings, "tools" | "resolveCredential">;
}
export interface Kernel {
  installLoom(options: {
    readonly source: string;
    readonly dependencySources?: readonly string[];
    readonly snapshotOnly?: boolean;
    readonly installedDirectory?: boolean;
    readonly expected?: { id: string; version?: string };
  }): Promise<InstalledLoomRef>;
  removeLoom(id: string): Promise<boolean>;
  listLooms(
    options?: PageOptions & { readonly id?: string },
  ): Promise<Page<LoomSummary>>;
  getLoom(selector: LoomSelector): Promise<InstalledLoom>;
  /** @internal Static build inputs for the local authoring CLI. */
  getLoomCatalog(
    locked?: readonly InstalledLoomRef[],
  ): Promise<readonly LoomCatalogEntry[]>;
  /** @internal Persistent metadata catalog for MCP resource discovery, without Run outputs. */
  getArtifactCatalog(options?: PageOptions): Promise<Page<ArtifactRecord>>;
  createRun(
    options: {
      readonly loom: InstalledLoomRef;
      readonly input: unknown;
      readonly inputFiles?: readonly string[];
      readonly confirmDelivery?: boolean;
    },
    project?: string,
  ): Promise<RunView>;
  startRun(runId: string): Promise<RunControlReceipt>;
  resumeRun(options: ResumeRunOptions): Promise<RunControlReceipt>;
  listInteractions(options: {
    readonly runId: string;
    readonly status?: InteractionRequest["status"];
  }): Promise<readonly InteractionRequest[]>;
  getInteraction(requestId: string): Promise<{
    readonly request: InteractionRequest;
    readonly responses: readonly InteractionResponseRecord[];
  }>;
  respondInteraction(
    requestId: string,
    response: InteractionResponse,
    callerContext: { readonly source: ResponseSource },
  ): Promise<InteractionReceipt>;
  cancelRun(runId: string, reason?: string): Promise<RunControlReceipt>;
  getRun(runId: string): Promise<RunView>;
  getRunActivity(runId: string): Promise<RunActivityView>;
  /** @internal Local service overview queries. */
  getRunOverview(): Promise<{ totalRuns: number; recent: RunSummary[] }>;
  listUnfinishedRuns(options?: PageOptions): Promise<Page<RunSummary>>;
  listRuns(options?: ListRunsOptions): Promise<Page<RunSummary>>;
  getRunResult(runId: string): Promise<RunResult>;
  listArtifacts(
    options: PageOptions & { readonly runId: string },
  ): Promise<Page<ArtifactRecord>>;
  getArtifact(artifactId: string): Promise<ArtifactRecord>;
  /** @internal Verified full export for the local CLI. */
  exportArtifact(options: {
    artifactId: string;
    path: string;
    overwrite?: boolean;
  }): Promise<{ artifactId: string; path: string; size: number }>;
  readArtifact(options: {
    readonly artifactId: string;
    readonly offset?: number;
    readonly length?: number;
  }): Promise<ArtifactRead>;
  listAcceptances(
    options: PageOptions & { readonly runId: string },
  ): Promise<Page<AcceptanceRecord>>;
  getAcceptance(acceptanceId: string): Promise<AcceptanceRecord>;
  listRunEvents(
    options: {
      readonly runId: string;
      readonly after?: number;
      readonly limit?: number;
      readonly waitMs?: number;
    },
    signal?: AbortSignal,
  ): Promise<RunEventPage>;
  getStorageIssues(): Promise<readonly StorageIssue[]>;
  close(): Promise<void>;
  shutdown(): Promise<void>;
  readonly activeRunCount: number;
}
