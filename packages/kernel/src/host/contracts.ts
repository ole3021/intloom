import { interactionReceiptSchema } from "@intloom/loom-sdk";
import { runResultSchema } from "../runtime/run-facts.ts";
import { loomInputsSchema, jsonSchemaSchema } from "@intloom/loom-sdk";
import {
  runMetricsSchema,
  runLimitsSchema,
  runActivitySchema,
} from "../runtime/run-observation.ts";
import { controlSchema } from "../mirror/contracts.ts";
import * as z from "zod";
import type { RunView } from "../runtime/run-view.ts";
import type { LoomView } from "./project-contracts.ts";

export const errorViewSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});
const executionSchema = z.strictObject({
  source: z.enum(["cli", "studio", "agent_ide"]),
  agentExecutor: z.enum(["service", "mcp_client"]),
});
const readinessSchema = executionSchema.extend({
  status: z.enum(["available", "configuration_required", "unavailable"]),
  error: errorViewSchema.optional(),
});
const cursorSchema = z.strictObject({
  stageName: z.string().min(1),
  stepName: z.string().min(1),
});
export const runViewDataSchema = z.strictObject({
  loomIdentity: z.string().optional(),
  historical: z.boolean().optional(),
  pauseRequested: z.boolean().optional(),
  startedBy: z
    .strictObject({ serviceInstanceId: z.uuid(), operationId: z.uuid() })
    .optional(),
  serviceInstanceId: z.uuid().optional(),
  revision: z.number().int().positive().optional(),
  metrics: runMetricsSchema.optional(),
  limits: runLimitsSchema.optional(),
  activity: z.array(runActivitySchema).optional(),
  results: z.array(runResultSchema).optional(),
  settled: z.boolean().optional(),
  stopReason: z.enum(["user_cancel", "budget_exceeded"]).optional(),
  control: controlSchema.optional(),
  runId: z.string().min(1),
  execution: executionSchema,
  loomName: z.string().min(1),
  cursor: cursorSchema,
  output: z.json().optional(),
  status: z.enum(["running", "waiting", "paused", "completed", "failed"]),
  pendingAgentCall: z
    .strictObject({
      id: z.string().min(1),
      agentId: z.string().min(1),
      phase: z.enum(["available", "claimed"]),
      createdAt: z.iso.datetime(),
    })
    .optional(),
  interactionReceipts: z.array(interactionReceiptSchema).optional(),
  pendingAction: z
    .strictObject({
      id: z.string().min(1),
      loomName: z.string().min(1),
      cursor: cursorSchema,
      kind: z.enum([
        "user_ask_questions",
        "user_ask_confirmation",
        "user_ask_interaction",
      ]),
      request: z.json(),
      createdAt: z.iso.datetime(),
    })
    .optional(),
  lastError: errorViewSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const runViewSchema = runViewDataSchema.transform((value): RunView => {
  const {
    historical,
    pauseRequested,
    startedBy,
    control,
    pendingAction,
    pendingAgentCall,
    lastError,
    serviceInstanceId,
    revision,
    metrics,
    limits,
    activity,
    results,
    settled,
    stopReason,
    output,
    interactionReceipts,
    loomIdentity,
    ...required
  } = value;
  return {
    ...required,
    ...(loomIdentity === undefined ? {} : { loomIdentity }),
    ...(output === undefined ? {} : { output }),
    ...(interactionReceipts === undefined ? {} : { interactionReceipts }),
    ...(pauseRequested === undefined ? {} : { pauseRequested }),
    ...(historical === undefined ? {} : { historical }),
    ...(startedBy === undefined ? {} : { startedBy }),
    ...(control === undefined ? {} : { control }),
    ...(serviceInstanceId === undefined ? {} : { serviceInstanceId }),
    ...(revision === undefined ? {} : { revision }),
    ...(metrics === undefined ? {} : { metrics }),
    ...(limits === undefined ? {} : { limits }),
    ...(activity === undefined ? {} : { activity }),
    ...(results === undefined ? {} : { results }),
    ...(settled === undefined ? {} : { settled }),
    ...(stopReason === undefined ? {} : { stopReason }),
    ...(pendingAction === undefined ? {} : { pendingAction }),
    ...(pendingAgentCall === undefined ? {} : { pendingAgentCall }),
    ...(lastError === undefined ? {} : { lastError }),
  };
});
export const loomViewSchema: z.ZodType<LoomView> = z
  .discriminatedUnion("isAvailable", [
    z.strictObject({
      packageName: z.string(),
      loomName: z.string(),
      isAvailable: z.literal(true),
      inputs: loomInputsSchema,
      contract: z
        .strictObject({ input: jsonSchemaSchema, output: jsonSchemaSchema })
        .optional(),
      readiness: readinessSchema.optional(),
    }),
    z.strictObject({
      packageName: z.string(),
      loomName: z.string().optional(),
      isAvailable: z.literal(false),
      phase: z.enum(["discover", "load", "agent", "register"]),
      error: errorViewSchema,
    }),
  ])
  .transform((value): LoomView => {
    if (value.isAvailable) {
      const { readiness, contract, ...base } = value;
      const required = {
        ...base,
        ...(contract === undefined ? {} : { contract }),
      };
      if (!readiness) return required;
      const { error, ...policy } = readiness;
      return {
        ...required,
        readiness: { ...policy, ...(error === undefined ? {} : { error }) },
      };
    }
    const { loomName, ...required } = value;
    return { ...required, ...(loomName === undefined ? {} : { loomName }) };
  });

export const serviceInfoSchema = z.strictObject({
  version: z.literal(1),
  projectRoot: z.string().min(1),
  pid: z.number().int().positive(),
  instanceId: z.uuid(),
  url: z.url(),
  startedAt: z.iso.datetime(),
  storage: z.enum(["file", "sqlite"]),
  logFile: z
    .string()
    .regex(/^LOG-\d{8}T\d{9}Z\.jsonl$/u)
    .optional(),
});
export type ServiceInfo = z.infer<typeof serviceInfoSchema>;
export const serviceLockSchema = z.strictObject({
  pid: z.number().int().positive(),
  instanceId: z.uuid(),
});
export type ServiceLock = z.infer<typeof serviceLockSchema>;
export const serviceStatusSchema = serviceInfoSchema.extend({
  execution: z
    .strictObject({
      useMcpAgent: z.boolean(),
      serviceConfigured: z.boolean(),
      preparedServiceAgents: z.number().int().nonnegative(),
    })
    .optional(),
  logError: errorViewSchema.optional(),
  loomCount: z.number().int().nonnegative(),
  availableLoomCount: z.number().int().nonnegative(),
  runningRuns: z.number().int().nonnegative(),
  waitingRuns: z.number().int().nonnegative(),
  pausedRuns: z.number().int().nonnegative().optional(),
  completedRuns: z.number().int().nonnegative(),
  failedRuns: z.number().int().nonnegative(),
});
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;

export const connectionSchema = z.strictObject({
  version: z.literal(1),
  projectRoot: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
  storage: z.enum(["file", "sqlite"]),
});
export type ServiceConnection = z.infer<typeof connectionSchema>;
export function serviceUrl(connection: ServiceConnection) {
  return `http://127.0.0.1:${connection.port}/mcp`;
}
