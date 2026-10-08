import { KERNEL_ERRORS } from "../errors/kernel.ts";
import type { Effector } from "./contracts.ts";
import { executeAgent } from "./execute-agent.ts";
import { executeCode } from "./execute-code.ts";
import type { EffectorOptions } from "./execution.ts";

/** Created and injected by the host; stores execution policy without owning Runs, business State, or clients. */
export function createEffector(options: EffectorOptions = {}): Effector {
  const maxAgentSteps = options.maxAgentSteps ?? 10;
  if (!Number.isSafeInteger(maxAgentSteps) || maxAgentSteps < 1)
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "maxAgentSteps must be a positive safe integer.",
    });
  return Object.freeze({
    executeCode,
    executeAgent: (agent, input, access) =>
      executeAgent(agent, input, access, maxAgentSteps),
  } satisfies Effector);
}
