import { z } from "zod";
import type { JsonData } from "../json.ts";
import type { LoomInput } from "../loom/input.ts";
import {
  toolDefinitionSchema,
  type CheckedTools,
  type ToolDefinition,
} from "../tools/definition.ts";
import { relativePathSchema } from "../loom/output.ts";
import type { AgentContext } from "./context.ts";

export interface AgentDefinition<Result = unknown> {
  readonly kind: "agent";
  readonly instructions:
    | string
    | ((context: AgentContext) => string | Promise<string>);
  readonly model?: string;
  readonly tools?: Readonly<Record<string, ToolDefinition>>;
  readonly skills?: readonly string[];
  readonly loomInput?: (input: LoomInput) => string;
  readonly returns?: z.ZodType<Result>;
}

export const agentDefinitionSchema = z.strictObject({
  kind: z.literal("agent"),
  instructions: z.union([
    z.string().trim().min(1),
    z.custom<(context: AgentContext) => string | Promise<string>>(
      (value) => typeof value === "function",
      "Expected instructions text or a function",
    ),
  ]),
  model: z.string().trim().min(1).optional(),
  tools: z
    .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_-]*$/), toolDefinitionSchema)
    .optional(),
  skills: z.array(relativePathSchema).optional(),
  loomInput: z
    .custom<(input: LoomInput) => string>(
      (value) => typeof value === "function",
      "Expected a LoomInput mapping function",
    )
    .optional(),
  returns: z.instanceof(z.ZodType).optional(),
});

export function agent<
  Result = string,
  const Tools extends Record<string, ToolDefinition> = Record<never, never>,
>(
  definition: Omit<AgentDefinition<Result>, "kind" | "tools" | "returns"> & {
    readonly tools?: Tools & CheckedTools<Tools>;
    readonly returns?: z.ZodType<Result> &
      (Result extends JsonData<Result> ? unknown : never);
  },
): AgentDefinition<Result> {
  return { ...definition, kind: "agent" };
}
