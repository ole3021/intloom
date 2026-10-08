import type {
  ListPage,
  ReadonlyJsonValue,
  RunView,
  StoredArtifact,
  StoredRecord,
  WorkflowView,
} from "@intloom/kernel";
import type {
  ArtifactQuery,
  ArtifactSelector,
  ArtifactSummary,
} from "../application/artifacts.ts";

/** Business operations shared by CLI and Studio; transports never own Run or Stage state. */
export interface ProjectClient {
  flow(flowName: string, intent: string): Promise<RunView>;
  getRun(runId: string): Promise<RunView>;
  answerAsk(
    runId: string,
    actionId: string,
    answer: ReadonlyJsonValue,
  ): Promise<RunView>;
  cancelRun(runId: string): Promise<RunView>;
  listRuns(flowName?: string): Promise<readonly RunView[]>;
  listWorkflows(): Promise<readonly WorkflowView[]>;
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
