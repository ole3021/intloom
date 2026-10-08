import { workflowProtocolVersion } from "@intloom/workflow-sdk";
import * as z from "zod";

const name = z
  .string()
  .min(1)
  .refine(
    (value) => value.trim() === value,
    "Names must not have surrounding whitespace",
  )
  .refine(
    (value) => !["__proto__", "prototype", "constructor"].includes(value),
    "Reserved name",
  );
const reference = z.string().min(1);
const routeTarget = z.union([
  z.strictObject({ target: name }),
  z.strictObject({ end: z.literal(true) }),
]);
const codeStep = z.strictObject({
  type: z.literal("code"),
  code: reference,
  on: z.record(name, routeTarget),
});
const agentStep = z.strictObject({
  type: z.literal("agent"),
  agent: reference,
  llm: name,
  outputSchema: reference,
  skills: z.array(reference).default([]),
  tools: z.array(reference).default([]),
  on: z.record(name, routeTarget),
});
export const workflowSchema = z.strictObject({
  workflow: z.strictObject({
    name,
    exclusive: z.boolean().optional(),
    entry: name,
    stages: z.record(
      name,
      z.strictObject({ stage: reference, on: z.record(name, routeTarget) }),
    ),
  }),
});
export const stageSchema = z.strictObject({
  stage: z.strictObject({
    name,
    state: z.strictObject({ schema: reference, initialize: reference }),
    entry: name,
    steps: z.record(name, z.discriminatedUnion("type", [codeStep, agentStep])),
  }),
});
export const metadataSchema = z.strictObject({ name, description: z.string() });
export const packageSchema = z.object({
  name: name,
  version: name,
  type: z.literal("module"),
  dependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  intloom: z.strictObject({
    type: z.literal("workflow"),
    version: z.literal(workflowProtocolVersion),
  }),
});
