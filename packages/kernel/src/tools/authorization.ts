import type { LoomInput, ProcessInput } from "@intloom/loom-sdk";
import { isWithin, resolvePath } from "../paths.ts";
import type {
  AuthorizationAnswer,
  AuthorizationRequest,
} from "../runs/contracts.ts";

export class AuthorizationDeniedError extends Error {
  override readonly name = "AuthorizationDeniedError";
}

export class Authorization {
  readonly #grants: AuthorizationRequest[] = [];
  constructor(
    private readonly options: {
      dataDir: string;
      workDir: string;
      tempDir: string;
      installationDir: string;
      input: LoomInput;
      ask: (
        executionId: string,
        request: AuthorizationRequest,
        signal: AbortSignal,
      ) => Promise<AuthorizationAnswer>;
    },
  ) {}

  async path(
    executionId: string,
    path: string,
    operation: "read" | "write",
    signal: AbortSignal,
    followFinal = true,
  ): Promise<string> {
    signal.throwIfAborted();
    const { workDir, tempDir, dataDir, installationDir, input } = this.options;
    const target = await resolvePath(path, workDir, followFinal);
    const writable = [workDir, tempDir].some((root) => isWithin(root, target));
    if (
      operation === "write" &&
      ((isWithin(dataDir, target) && !writable) ||
        isWithin(target, dataDir) ||
        isWithin(installationDir, target))
    ) {
      throw new AuthorizationDeniedError(
        `Internal data and installations are not writable through file tools: ${target}`,
      );
    }
    const readable =
      operation === "read" &&
      (isWithin(installationDir, target) ||
        input.files?.includes(target) ||
        input.folders?.some((root) => isWithin(root, target)));
    if (!writable && !readable) {
      const request = { kind: "path", path: target, operation } as const;
      if (
        !this.#grants.some(
          (grant) =>
            grant.kind === "path" &&
            grant.operation === operation &&
            isWithin(grant.path, target),
        )
      ) {
        await this.approve(executionId, request, signal);
      }
    }
    signal.throwIfAborted();
    return target;
  }

  async command(
    executionId: string,
    input: ProcessInput,
    signal: AbortSignal,
  ): Promise<ProcessInput> {
    const cwd = await resolvePath(input.cwd, this.options.workDir);
    const request: AuthorizationRequest = {
      kind: "command",
      command: input.command,
      args: input.args,
      cwd,
      ...(input.env === undefined
        ? {}
        : {
            env: Object.fromEntries(
              Object.entries(input.env).sort(([a], [b]) => a.localeCompare(b)),
            ),
          }),
    };
    if (
      !this.#grants.some(
        (grant) =>
          grant.kind === "command" &&
          JSON.stringify(grant) === JSON.stringify(request),
      )
    )
      await this.approve(executionId, request, signal);
    signal.throwIfAborted();
    return { ...input, cwd };
  }

  private async approve(
    executionId: string,
    request: AuthorizationRequest,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    const answer = await this.options.ask(executionId, request, signal);
    signal.throwIfAborted();
    if (answer === "deny")
      throw new AuthorizationDeniedError(
        request.kind === "path"
          ? `Access denied: ${request.operation} ${request.path}`
          : `Command denied: ${request.command}`,
      );
    if (answer === "run") this.#grants.push(request);
  }
}
