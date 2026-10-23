import { codeRecoverySchema } from "@intloom/loom-sdk";
import { createDelegatedSessions } from "./delegated/sessions.ts";
import { ERRORS } from "../errors.ts";
import type { Execution } from "./contracts.ts";
import { executeAgent } from "./execute-agent.ts";
import { executeCode } from "./execute-code.ts";
import type { ExecutionOptions } from "./execution.ts";

/** Created and injected by the host; stores execution policy without owning Runs, business State, or clients. */
export function createExecution(options: ExecutionOptions = {}): Execution {
  const maxAgentSteps = options.maxAgentSteps ?? 10;
  if (!Number.isSafeInteger(maxAgentSteps) || maxAgentSteps < 1)
    throw ERRORS.create("INVALID_REQUEST", {
      message: "maxAgentSteps must be a positive safe integer.",
    });
  return Object.freeze({
    delegated: createDelegatedSessions(),
    executeCode,
    recoverCode(code, saved, access) {
      if (!code.recover) throw ERRORS.create("RUN_INTERRUPTED");
      const recover = code.recover;
      const input = codeRecoverySchema.parse(saved);
      return executeCode((access) => recover(input, access), access);
    },
    executeAgent: (agent, input, access) =>
      executeAgent(
        agent,
        input,
        access,
        maxAgentSteps,
        options.serviceModelObserver,
      ),
  } satisfies Execution);
}
