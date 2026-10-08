import * as z from "zod";
import { KERNEL_ERRORS } from "../errors/kernel.ts";

export const runSourceSchema = z.enum(["cli", "studio", "agent_ide"]);
export type RunSource = z.infer<typeof runSourceSchema>;
export type AgentExecutorKind = "mcp_client" | "service";
export interface RunExecution {
  readonly source: RunSource;
  readonly agentExecutor: AgentExecutorKind;
}
export function resolveRunExecution(
  source: RunSource,
  useMcpAgent: boolean,
): RunExecution {
  if (!runSourceSchema.safeParse(source).success)
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "Unknown Run source.",
    });
  return Object.freeze({
    source,
    agentExecutor:
      source === "agent_ide" && useMcpAgent ? "mcp_client" : "service",
  });
}
export function freezeRunExecution(execution: RunExecution): RunExecution {
  if (
    !runSourceSchema.safeParse(execution.source).success ||
    !["mcp_client", "service"].includes(execution.agentExecutor) ||
    (execution.source !== "agent_ide" && execution.agentExecutor !== "service")
  )
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "Invalid Run execution policy.",
    });
  return Object.freeze({
    source: execution.source,
    agentExecutor: execution.agentExecutor,
  });
}
