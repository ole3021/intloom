import * as z from "zod";
import type { RunView, WorkflowView } from "@intloom/kernel";

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
export const runViewSchema = z
  .strictObject({
    runId: z.string().min(1),
    execution: executionSchema,
    flowName: z.string().min(1),
    cursor: cursorSchema,
    status: z.enum(["running", "waiting", "completed", "failed"]),
    pendingAgentCall: z
      .strictObject({
        id: z.string().min(1),
        agentId: z.string().min(1),
        phase: z.enum(["available", "claimed"]),
        createdAt: z.iso.datetime(),
      })
      .optional(),
    pendingAction: z
      .strictObject({
        id: z.string().min(1),
        flowName: z.string().min(1),
        cursor: cursorSchema,
        kind: z.enum(["user_ask_questions", "user_ask_confirmation"]),
        request: z.json(),
        createdAt: z.iso.datetime(),
      })
      .optional(),
    lastError: errorViewSchema.optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .transform((value): RunView => {
    const { pendingAction, pendingAgentCall, lastError, ...required } = value;
    return {
      ...required,
      ...(pendingAction === undefined ? {} : { pendingAction }),
      ...(pendingAgentCall === undefined ? {} : { pendingAgentCall }),
      ...(lastError === undefined ? {} : { lastError }),
    };
  });
export const workflowViewSchema: z.ZodType<WorkflowView> = z
  .discriminatedUnion("isAvailable", [
    z.strictObject({
      packageName: z.string(),
      flowName: z.string(),
      isAvailable: z.literal(true),
      readiness: readinessSchema.optional(),
    }),
    z.strictObject({
      packageName: z.string(),
      flowName: z.string().optional(),
      isAvailable: z.literal(false),
      phase: z.enum(["discover", "load", "agent", "register"]),
      error: errorViewSchema,
    }),
  ])
  .transform((value): WorkflowView => {
    if (value.isAvailable) {
      const { readiness, ...required } = value;
      if (!readiness) return required;
      const { error, ...policy } = readiness;
      return {
        ...required,
        readiness: { ...policy, ...(error === undefined ? {} : { error }) },
      };
    }
    const { flowName, ...required } = value;
    return { ...required, ...(flowName === undefined ? {} : { flowName }) };
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
  workflowCount: z.number().int().nonnegative(),
  availableWorkflowCount: z.number().int().nonnegative(),
  runningRuns: z.number().int().nonnegative(),
  waitingRuns: z.number().int().nonnegative(),
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
