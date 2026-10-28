import type { LoomInvocationInput as LoomInput } from "@intloom/loom-sdk";
import type { ListPage, StoredArtifact, StoredRecord } from "@intloom/loom-sdk";
import type { ReadonlyJsonValue } from "@intloom/loom-sdk";
import type { RunView } from "../runtime/run-view.ts";
import type { LoomView } from "../host/project-contracts.ts";
import type {
  ArtifactQuery,
  ArtifactSelector,
  ArtifactSummary,
} from "./artifacts.ts";

/** Business operations shared by CLI and Studio; transports never own Run or Stage state. */
export interface ProjectClient {
  run(loomName: string, input: LoomInput): Promise<RunView>;
  getRun(runId: string): Promise<RunView>;
  answerAsk(
    runId: string,
    actionId: string,
    answer: ReadonlyJsonValue,
  ): Promise<RunView>;
  cancelRun(runId: string): Promise<RunView>;
  listRuns(loomName?: string): Promise<readonly RunView[]>;
  listLooms(): Promise<readonly LoomView[]>;
  getRecord(recordId: string): Promise<StoredRecord | null>;
  getArtifact(selector: ArtifactSelector): Promise<StoredArtifact | null>;
  listArtifacts(query?: ArtifactQuery): Promise<ListPage<ArtifactSummary>>;
  close(): Promise<void>;
}

/** Explicit connection supplied by a trusted local backend; contains credentials and must not be logged. */
export interface ProjectConnection {
  readonly url: string;
  readonly token: string;
}

export interface ProjectClientOptions {
  /** Logging correlation only; never an execution deduplication key. */
  readonly requestId?: string;
}
