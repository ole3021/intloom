import type { FileTools } from "../tools/fs.ts";
import type { KeyValueStorage } from "../tools/store.ts";
import type { UserTools } from "../tools/user.ts";
import type { ProcessTools } from "../tools/process.ts";
import type { Exec, ExecInput, ExecOutput, ValidExec } from "./types.ts";

export type PatchId = `PCH-${string}`;

export type ExecutionInfo =
  | { readonly mode: "chat" }
  | {
      readonly mode: "run";
      readonly runId: string;
      readonly scope: "intloom" | "workspace";
      readonly workDir: string;
      readonly tempDir: string;
    }
  | {
      readonly mode: "patch";
      readonly runId: string;
      readonly patchId: PatchId;
      readonly scope: "intloom" | "workspace";
      readonly workDir: string;
      readonly tempDir: string;
    };

export type AgentContext = ExecutionInfo & { readonly prompt: string };

export interface CodeTools {
  readonly signal: AbortSignal;
  readonly fs: FileTools;
  readonly process: ProcessTools;
  readonly user: UserTools;
  readonly store: KeyValueStorage;
  reject(input: { readonly reason: string }): never;
  exec<E extends Exec>(
    target: E & ValidExec<E>,
    input: ExecInput<E>,
  ): Promise<ExecOutput<E>>;
}

export type CodeContext = ExecutionInfo & CodeTools;
export type RunContext = Extract<CodeContext, { mode: "run" }>;
