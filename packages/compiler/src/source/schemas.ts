import {
  loomProtocolVersion,
  loomNameSchema as name,
  loomMetadataSchema,
  loomInputsSchema,
  agentModelTypeSchema,
} from "@intloom/loom-sdk";
import * as z from "zod";

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
  llm: agentModelTypeSchema,
  outputSchema: reference,
  skills: z.array(reference).default([]),
  tools: z.array(reference).default([]),
  on: z.record(name, routeTarget),
});
export const loomSchema = loomMetadataSchema.extend({
  version: z.literal(loomProtocolVersion),
  name,
  exclusive: z.boolean().optional(),
  inputs: loomInputsSchema,
  entry: name,
  stages: z.record(
    name,
    z.strictObject({ stage: reference, on: z.record(name, routeTarget) }),
  ),
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
export const packageSchema = z.looseObject({
  name: z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
  type: z.literal("module"),
  dependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
  loom: loomSchema,
});
export type SourcePackage = z.infer<typeof packageSchema>;
export type SourceStage = z.infer<typeof stageSchema>;
export type SourceMetadata = z.infer<typeof metadataSchema>;
