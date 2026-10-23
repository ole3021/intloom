import type { LoomInput, StorageReadAccess } from "@intloom/loom-sdk";
import type { OperationRef, Runtime } from "../runtime/contracts.ts";
import type { MutationResult } from "../runtime/mutation.ts";
import type { RunView } from "../runtime/run-view.ts";
import type { RunSource } from "../runtime/execution-policy.ts";
import type { AgentCallApi } from "../execution/delegated/contracts.ts";
import type { LoomView } from "../host/project-contracts.ts";
import type { ServiceStatus } from "../host/contracts.ts";
import type { OperationReceipts } from "./receipts.ts";
import type { RestoreMirrorInput } from "./mirrors.ts";
import type { MirrorControl } from "../mirror/contracts.ts";

/** Borrowed ports only: no resource disposal, registries, execution preparation or Runtime construction. */
export interface OperationsPorts {
  readonly projectRoot: string;
  readonly receipts: OperationReceipts;
  readonly runtime: Pick<
    Runtime,
    | "getRun"
    | "listRuns"
    | "watchRun"
    | "findRun"
    | "submitAnswer"
    | "pauseRun"
    | "cancelRun"
    | "resumeRun"
  >;
  readonly delegated: AgentCallApi;
  readonly storage: StorageReadAccess;
  assertOpen(): void;
  startRun(
    loomName: string,
    input: LoomInput,
    source: RunSource,
    operation: OperationRef,
  ): Promise<MutationResult<RunView>>;
  listLooms(source: RunSource): Promise<readonly LoomView[]>;
  presentRun(run: RunView): RunView;
  status(): Promise<ServiceStatus>;
  restoreMirror(input: RestoreMirrorInput): Promise<RestoreMirrorResult>;
}

export type RestoreMirrorResult = {
  readonly runId: string;
  readonly traceId: string;
  readonly targetProject: string;
  readonly status: "paused";
  readonly sourceMirrorId: string;
  readonly scope: MirrorControl["scope"];
  readonly scopeTarget?: {
    readonly stageName: string;
    readonly stageVisitId?: number | undefined;
  };
  readonly warnings: readonly string[];
  readonly dryRun: boolean;
  readonly plan: {
    readonly files: string[];
    readonly storage: string;
    readonly checkpoint: string;
  };
};
