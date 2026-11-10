import type { JsonValue } from "./json.ts";
import type {
  ExecutionError,
  OutcomeView,
  AcceptanceSummary,
  QualityStatus,
  ExecutionOrigin,
} from "./outcome.ts";
import type { InstalledLoomRef } from "../definitions/loom.ts";
import type { LoomManifest } from "./package.ts";

export class IntloomError extends Error {
  readonly code: string;
  readonly details?: JsonValue;
  constructor(code: string, message: string, details?: JsonValue) {
    super(message);
    this.name = "IntloomError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
  toJSON(): ExecutionError {
    return {
      code: this.code,
      message: this.message,
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}
export type RunStatus =
  | "created"
  | "running"
  | "waiting"
  | "stopping"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "interrupted";
export interface RunWaitView {
  readonly waitId: string;
  readonly kind: "interaction" | "external" | "child";
  readonly origin: ExecutionOrigin;
  readonly requestId?: string;
  readonly childRunId?: string;
}
export type RunStopReason =
  | { readonly kind: "cancel"; readonly message?: string }
  | { readonly kind: "error"; readonly error: ExecutionError };
export interface StorageIssue {
  readonly directory: string;
  readonly code: "STORAGE_MISSING" | "STORAGE_UNAVAILABLE";
  readonly message: string;
}
export interface RunLocation {
  readonly directory?: string;
  readonly projectDir?: string;
  readonly dataDir: string;
  readonly storage: "global" | "project";
}
export interface RunSummary {
  readonly deliveryStatus?: "pending" | "approved" | "rejected" | "cancelled";
  readonly command?: string;
  readonly harness?: "mastra" | "opencode";
  readonly location: RunLocation;
  readonly id: string;
  readonly status: RunStatus;
  readonly loom: InstalledLoomRef;
  readonly parentRunId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly waits: readonly RunWaitView[];
  readonly pendingInteractionIds: readonly string[];
  readonly error?: ExecutionError;
  readonly stopReason?: RunStopReason;
  readonly recoveryIssue?: ExecutionError;
}
export interface RunView extends RunSummary {
  readonly output?: JsonValue;
}
export interface RunControlReceipt {
  readonly run: RunView;
  readonly operation: "start" | "resume" | "cancel";
  readonly disposition: "accepted" | "no_change";
}
export interface RunResult {
  readonly candidate?: import("./outcome.ts").ArtifactRef;
  readonly deliveryStatus?: RunSummary["deliveryStatus"];
  readonly rejectionReason?: string;
  readonly runId: string;
  readonly runStatus: RunStatus;
  readonly output?: JsonValue;
  readonly outcome?: OutcomeView;
  readonly acceptance?: AcceptanceSummary;
  readonly quality: QualityStatus;
  readonly error?: ExecutionError;
}
export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}
export interface PageOptions {
  readonly cursor?: string;
  readonly limit?: number;
}
export type LoomSelector =
  | InstalledLoomRef
  | { readonly artifactDigest: string }
  | {
      readonly id: string;
      readonly version?: string;
      readonly command?: string;
    };
export interface LoomSummary {
  readonly name: string;
  readonly source: "intloom";
  readonly active: boolean;
  readonly ref: InstalledLoomRef;
  readonly description: string;
  readonly entry: LoomManifest["entry"];
}
export interface InstalledLoom {
  readonly commands?: import("../package-format/author.ts").AuthorManifest["commands"];
  readonly defaultCommand?: string;
  readonly ref: InstalledLoomRef;
  readonly manifest: LoomManifest;
}
export interface ListRunsOptions extends PageOptions {
  readonly status?: RunStatus;
  readonly loom?: LoomSelector;
  readonly parentRunId?: string;
}
