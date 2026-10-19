import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  admissionSchema,
  operationQuerySchema,
} from "@intloom/kernel/operations";
import type { LoomInput } from "@intloom/loom-sdk";
import { E2eError, runSchema } from "../contracts.ts";
import type { Evidence } from "../evidence.ts";
import { processResult } from "../process.ts";

export class CmdDriver {
  readonly cli: string;
  readonly project: string;
  readonly evidence: Evidence;
  readonly environment: NodeJS.ProcessEnv;
  readonly timeout: number;
  constructor(
    cli: string,
    project: string,
    evidence: Evidence,
    environment: NodeJS.ProcessEnv,
    timeout: number,
  ) {
    this.cli = cli;
    this.project = project;
    this.evidence = evidence;
    this.environment = environment;
    this.timeout = timeout;
  }
  async call(
    args: string[],
    signal?: AbortSignal,
    capture = true,
  ): Promise<unknown> {
    const result = await processResult(
      process.execPath,
      [
        this.cli,
        ...(args[0] === "init" ? [] : ["--project", this.project]),
        ...args,
        "--json",
        "--no-color",
        "--no-interactive",
      ],
      dirname(this.project),
      this.timeout,
      signal,
      this.environment,
    );
    let envelope: {
      ok?: boolean;
      data?: unknown;
      error?: { code?: string; message?: string };
    };
    try {
      envelope = JSON.parse(result.stdout);
    } catch {
      await this.evidence.event("cli_response_invalid", { args, result });
      throw new E2eError(
        "CLI_OUTCOME_UNKNOWN",
        "The CLI did not return a valid receipt. Do not replay mutations.",
        "system",
      );
    }
    this.evidence.protect(envelope);
    if (capture || !envelope.ok)
      await this.evidence.event("cli", { args, result });
    if (!envelope.ok)
      throw new E2eError(
        envelope.error?.code ?? "CLI_REQUEST_FAILED",
        envelope.error?.message ?? "CLI request failed.",
        "system",
      );
    return envelope.data;
  }
  async start(loomName: string, input: LoomInput, signal: AbortSignal) {
    const args = ["run", loomName];
    if (input.prompt !== undefined) args.push("--prompt", input.prompt);
    for (const [slot, flag] of [
      ["files", "--file"],
      ["dirs", "--dir"],
      ["urls", "--url"],
    ] as const)
      for (const path of input[slot] ?? []) args.push(flag, path);
    return this.admission(await this.call(args, signal), signal);
  }
  private async admission(value: unknown, signal: AbortSignal) {
    const admitted = admissionSchema.parse(value);
    let receipt = admitted.receipt;
    const deadline = Date.now() + this.timeout;
    while (receipt.status === "pending") {
      if (Date.now() >= deadline)
        throw new E2eError(
          "CLI_ADMISSION_UNKNOWN",
          "The operation is still pending. Preserve its identity; do not repeat it.",
          "system",
        );
      await delay(100, undefined, { signal });
      const next = operationQuerySchema.parse(
        await this.call(
          [
            "operation",
            receipt.operationId,
            "--instance",
            receipt.serviceInstanceId,
          ],
          signal,
          false,
        ),
      );
      if (next.status === "found") receipt = next.receipt;
      else
        throw new E2eError(
          "CLI_ADMISSION_UNKNOWN",
          "The original operation receipt is unavailable.",
          "system",
        );
    }
    if (receipt.status === "rejected" || receipt.status === "indeterminate")
      throw new E2eError(receipt.error.code, receipt.error.message, "system");
    await this.evidence.event("admission_accepted", receipt);
    return admitted.run
      ? runSchema.parse(admitted.run)
      : this.get(receipt.runId, signal);
  }
  async get(runId: string, signal?: AbortSignal) {
    return runSchema.parse(await this.call(["attach", runId], signal, false));
  }
  async answer(
    runId: string,
    actionId: string,
    answer: unknown,
    signal: AbortSignal,
  ) {
    return this.admission(
      await this.call(
        [
          "answer",
          runId,
          "--action",
          actionId,
          "--answer",
          JSON.stringify(answer),
        ],
        signal,
      ),
      signal,
    );
  }
  async result(kind: "artifact" | "record", id: string, signal: AbortSignal) {
    return this.call([kind, id], signal);
  }
  async close() {}
}
