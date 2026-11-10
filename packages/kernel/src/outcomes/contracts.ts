import type {
  ArtifactRecord,
  AcceptanceRecord,
  RuntimeContext,
  ExecutionScope,
  JsonValue,
  RunResult,
} from "@intloom/loom-sdk";
import type { RunRecord } from "../lifecycle/run-contracts.ts";

export type OutcomeProjection = Pick<
  RunResult,
  | "quality"
  | "outcome"
  | "acceptance"
  | "candidate"
  | "deliveryStatus"
  | "rejectionReason"
>;
export interface OutcomeServices {
  context(
    record: RunRecord,
    scope: ExecutionScope,
  ): Pick<RuntimeContext, "artifacts" | "acceptance">;
  complete(record: RunRecord, output: JsonValue): Promise<OutcomeProjection>;
}
export interface OutcomeRepository {
  saveArtifact(record: ArtifactRecord): Promise<void>;
  getArtifact(id: string): Promise<ArtifactRecord | undefined>;
  listArtifacts(options: OutcomeListQuery): Promise<readonly ArtifactRecord[]>;
  saveAcceptance(record: AcceptanceRecord): Promise<void>;
  getAcceptance(id: string): Promise<AcceptanceRecord | undefined>;
  listAcceptances(
    options: OutcomeListQuery & { runId: string },
  ): Promise<readonly AcceptanceRecord[]>;
}

export interface OutcomeListQuery {
  readonly runId?: string;
  readonly after?: string | undefined;
  readonly limit: number;
}
