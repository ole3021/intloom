/** Host-bound engineering operations. Commands use argument arrays, never an implicit shell. */
export interface ProjectCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly timeoutMs?: number;
}

export interface ProjectCommandResult {
  readonly command: ProjectCommand;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly truncated: boolean;
}

export interface ProjectAccess {
  snapshot(): Promise<Readonly<Record<string, string>>>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
  run(
    command: ProjectCommand,
    signal?: AbortSignal,
  ): Promise<ProjectCommandResult>;
}
