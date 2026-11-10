import { z } from "zod";
const id = z.string().min(1);
const identity = z.strictObject({ id, version: id });
const ref = identity.extend({
  artifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
const selector = z.union([
  ref,
  identity.partial({ version: true }).extend({ command: id.optional() }),
  ref.pick({ artifactDigest: true }),
]);
const pagination = {
  cursor: id.optional(),
  limit: z.number().int().min(1).max(100).optional(),
};
const directory = z
  .string()
  .regex(/^\//, "directory must be an absolute path")
  .optional();
const run = { runId: id };
const request = { requestId: id };
// These schemas describe the protocol arguments. Loom input and answer schemas remain Kernel-owned.
export const tools = [
  [
    "intloom_looms_list",
    "List installed Loom capabilities.",
    z.strictObject({ id: id.optional(), ...pagination }),
    "listLooms",
  ],
  [
    "intloom_loom_get",
    "Read a Loom manifest and its exact installed reference.",
    z.strictObject({ loom: selector }),
    "getLoom",
  ],
  [
    "intloom_run_create",
    "Create a Run without starting execution.",
    z.strictObject({
      loom: z.union([ref, id]),
      command: id.optional(),
      confirmDelivery: z.boolean().optional(),
      input: z.unknown().optional(),
      directory,
    }),
    "createRun",
  ],
  [
    "intloom_run_start",
    "Explicitly start a created Run.",
    z.strictObject(run),
    "startRun",
  ],
  [
    "intloom_runs_list",
    "List Run state summaries without business output; use intloom_run_get or intloom_run_result for output.",
    z.strictObject({
      status: z
        .enum([
          "created",
          "running",
          "waiting",
          "stopping",
          "succeeded",
          "failed",
          "cancelled",
          "interrupted",
        ])
        .optional(),
      loom: selector.optional(),
      parentRunId: id.optional(),
      ...pagination,
    }),
    "listRuns",
  ],
  [
    "intloom_run_get",
    "Read Run state, waits and child activity.",
    z.strictObject(run),
    "getRun",
  ],
  [
    "intloom_run_activity",
    "Read the shared execution tree, progress, interactions, artifacts and reported model usage.",
    z.strictObject(run),
    "getRunActivity",
  ],
  [
    "intloom_run_result",
    "Read formal output, delivery and quality independently of Run status.",
    z.strictObject(run),
    "getRunResult",
  ],
  [
    "intloom_run_events",
    "Read ordered execution events.",
    z.strictObject({
      ...run,
      after: z.number().int().nonnegative().optional(),
      limit: pagination.limit,
      waitMs: z.number().int().min(0).max(10_000).optional(),
    }),
    "listRunEvents",
  ],
  [
    "intloom_run_resume",
    "Resume a saved interaction or an external wait explicitly.",
    z.strictObject({
      ...run,
      requestId: id.optional(),
      waitId: id.optional(),
      resumeData: z.unknown().optional(),
    }),
    "resumeRun",
  ],
  [
    "intloom_run_stop",
    "Explicitly cancel business execution.",
    z.strictObject({ ...run, reason: z.string().optional() }),
    "cancelRun",
  ],
  [
    "intloom_interactions_list",
    "List existing interaction requests without opening a form.",
    z.strictObject({
      ...run,
      status: z.enum(["pending", "answered", "closed"]).optional(),
    }),
    "listInteractions",
  ],
  [
    "intloom_interaction_get",
    "Read an interaction and its recorded responses.",
    z.strictObject(request),
    "getInteraction",
  ],
  [
    "intloom_interaction_respond",
    "Submit an agent response; cannot satisfy a human-only policy.",
    z.strictObject({
      ...request,
      response: z.union([
        z.strictObject({ action: z.literal("submit"), value: z.unknown() }),
        z.strictObject({ action: z.enum(["decline", "dismiss"]) }),
      ]),
    }),
    "respondInteraction",
  ],
  [
    "intloom_interaction_prompt",
    "Present an existing pending request as a native form, or return CLI fallback instructions.",
    z.strictObject(request),
    "prompt",
  ],
  [
    "intloom_artifacts_list",
    "List immutable artifacts, including execution diagnostics.",
    z.strictObject({ ...run, ...pagination }),
    "listArtifacts",
  ],
  [
    "intloom_artifact_get",
    "Read artifact metadata and its resource URI.",
    z.strictObject({ artifactId: id }),
    "getArtifact",
  ],
  [
    "intloom_artifact_read",
    "Read at most 1 MiB as base64 with explicit range metadata.",
    z.strictObject({
      artifactId: id,
      offset: z.number().int().nonnegative().optional(),
      length: z
        .number()
        .int()
        .min(1)
        .max(1024 * 1024)
        .optional(),
    }),
    "readArtifact",
  ],
  [
    "intloom_acceptances_list",
    "List recorded acceptance evidence.",
    z.strictObject({ ...run, ...pagination }),
    "listAcceptances",
  ],
  [
    "intloom_acceptance_get",
    "Read an acceptance record and its candidate digest.",
    z.strictObject({ acceptanceId: id }),
    "getAcceptance",
  ],
] as const;
