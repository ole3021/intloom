import type {
  AgentDefinition,
  CodeDefinition,
  StepDefinition,
  ToolDefinition,
  WorkflowDefinition,
} from "@intloom/loom-sdk";
import type { ZodType } from "zod";

export type ExecutableComponent =
  | CodeDefinition
  | AgentDefinition
  | ToolDefinition
  | WorkflowDefinition;
export type InlineStep = StepDefinition<
  string,
  ZodType,
  ZodType,
  ZodType,
  ZodType
>;
