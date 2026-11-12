import {
  IntloomError,
  type ExecutionError,
  type ArtifactRead,
  type StorageIssue,
  type RunEvent,
  type JsonValue,
} from "@intloom/loom-sdk";
import type { Kernel } from "@intloom/kernel";

export interface ServiceStatus {
  status: "ready" | "closing";
  version: string;
  kernelVersion?: string;
  npmGlobalRoot?: string | undefined;
  activeRunCount: number;
  runRevision: number;
  mcpUrl: string;
  tokenPath: string;
  endpoint: string;
  logPath: string;
  storageIssues: readonly StorageIssue[];
}
export type ServiceLogRecord =
  | {
      kind: "diagnostic";
      time: string;
      level: string;
      message: string;
      runId?: string;
      loomId?: string;
      componentId?: string;
      data?: JsonValue;
    }
  | { kind: "event"; event: RunEvent; loomId: string; error?: ExecutionError };
export type ServiceMethods = Omit<
  Kernel,
  "close" | "shutdown" | "activeRunCount" | "readArtifact" | "listRunEvents"
> & {
  readArtifact(
    options: Parameters<Kernel["readArtifact"]>[0],
  ): Promise<Omit<ArtifactRead, "data"> & { encoding: "base64"; data: string }>;
  listRunEvents(
    options: Parameters<Kernel["listRunEvents"]>[0],
  ): ReturnType<Kernel["listRunEvents"]>;
  describeConfiguration: (
    projectDir?: string,
  ) => ReturnType<typeof import("@intloom/kernel").describeConfiguration>;
  serviceStatus(): Promise<ServiceStatus>;
  serviceShutdown(): Promise<{ status: "stopped" }>;
};
export type ConfigurationSummary = Awaited<
  ReturnType<ServiceMethods["describeConfiguration"]>
>;
export type ClientMethods = Omit<ServiceMethods, "createRun"> & {
  createRun(
    options: Parameters<ServiceMethods["createRun"]>[0],
  ): ReturnType<ServiceMethods["createRun"]>;
};
export type CallArguments<P extends unknown[]> = [] extends P
  ? [params?: P, signal?: AbortSignal]
  : [params: P, signal?: AbortSignal];
export type ServiceClient = <M extends keyof ClientMethods>(
  method: M,
  ...args: CallArguments<Parameters<ClientMethods[M]>>
) => ReturnType<ClientMethods[M]>;

export const maximumBytes = 8 * 1024 * 1024;
export interface Endpoint {
  formatVersion: 1;
  endpoint: string;
  token: string;
  pid: number;
  mcpUrl: string;
  version: string;
}
export interface Request {
  formatVersion: number;
  token: string;
  id: string;
  method: string;
  params: unknown[];
}
export interface Reply {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: ExecutionError;
}
export function publicError(error: unknown): ExecutionError {
  if (error instanceof IntloomError) return error.toJSON();
  // Package paths and native diagnostics stay on their local boundary, not in protocol errors.
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z][A-Z0-9_]*$/.test(error.code)
      ? error.code
      : "EXECUTION_FAILED";
  return { code, message: "The operation could not be completed." };
}
