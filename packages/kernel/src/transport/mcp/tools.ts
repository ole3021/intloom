import { registerApps } from "./apps.ts";
import type { Admission } from "../../operations/api-contracts.ts";
import { packageVersion } from "../../host/version.ts";
import { getLogger } from "@intloom/utils";
import {
  restoreMirrorSchema,
  resumeRunSchema,
} from "../../operations/mirrors.ts";
import * as z from "zod";
import {
  McpServer,
  type CallToolResult,
  type InputRequiredResult,
  type ServerContext,
} from "@modelcontextprotocol/server";
import type { ProjectOperations } from "../../operations/project.ts";
import {
  artifactQuerySchema,
  artifactSelectorSchema,
  parseArtifactQuery,
  parseArtifactSelector,
} from "../../operations/artifacts.ts";
import { handlePendingAction } from "../interaction/handle-action.ts";
import { resolveIde } from "../ide/resolve.ts";
import { mcpPresenter } from "./interaction.ts";
import { toolFailure, toolResult } from "./results.ts";
import { failure } from "../../errors.ts";
import { registerAgentTools } from "./agent-tools.ts";

const operation = { operationId: z.uuid(), serviceInstanceId: z.uuid() };
const text = z.string().refine((value) => value.trim().length > 0);
const instructions =
  "Read status first. Supply its serviceInstanceId and a fresh UUID operationId for run, answer_ask, interact, cancel_run and pause_run. Retain both IDs for receipt lookup and retry with exactly the same parameters. Use run once to create a Run and retain its returned runId. A running result is an accepted Run, not a terminal result; query get_run with that runId for progress. If waiting with pendingAgentCall, claim_agent_call using its id and a stable unique claimId. Execute the task instructions and Skills using only its declared call_agent_tool operations and read_agent_asset. Keep ownerToken private. Then complete_agent_call with raw output matching outputSchema, or fail_agent_call if unable. Completion returns a submission receipt. Query get_run until terminal. Client reasoning stays in the IDE; never configure or call a service model as a fallback. When get_run returns presentation and the host supports MCP Apps, call presentation.toolName with the existing runId to open its UI; opening never starts a Run. If no compatible App is available, or the human chooses standard controls, call interact with the existing runId and pendingAction.id. Terminal presentation is read-only and never replaces output or acceptance checks. If native forms are unavailable, ask the human and submit their exact answer via answer_ask. Agent execution does not authorize answering human questions or confirmation. Never invent answers or confirmations. Cancelling a form leaves the Run waiting; cancel_run explicitly stops it. Retry queries/claims/Tool calls/completion with their original identities and inputs, never run creation. Completed/failed are terminal; failed does not prove a transaction was uncommitted.";

/** All IDEs share Tool definitions and business entry points; protocol objects may be rebuilt while the application is reused. */
export async function createToolServer(
  application: ProjectOperations,
  ide?: string,
) {
  const server = new McpServer(
    { name: "intloom", version: packageVersion },
    { instructions },
  );
  if (application.source === "agent_ide")
    registerAgentTools(server, application);
  const guard =
    <T>(
      fn: (
        input: T,
        context: ServerContext,
      ) => Promise<CallToolResult | InputRequiredResult>,
    ) =>
    async (input: T, context: ServerContext) => {
      try {
        return await fn(input, context);
      } catch (error) {
        getLogger().warn("operation_rejected", { err: error });
        return toolFailure(error);
      }
    };
  server.registerTool(
    "run",
    {
      description:
        "Create one Loom Run from the user's input. Returns an admitted Run promptly, often with status running. Query get_run with its runId for later status; do not call run again to wait or answer a pending question.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({
        ...operation,
        loomName: text,
        input: z.json(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guard(async (input) =>
      toolResult({ ...(await application.admit("run", input)) }),
    ),
  );
  server.registerTool(
    "list_looms",
    {
      description: "List available Looms and initialization diagnostics.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async () => toolResult({ looms: await application.listLooms() })),
  );
  server.registerTool(
    "get_run",
    {
      description: "Read the current Run snapshot without advancing it.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({ runId: text }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async ({ runId }) =>
      toolResult({
        run: await application.getRun(runId),
        presentation: await application.apps.presentation(runId),
      }),
    ),
  );
  server.registerTool(
    "find_run",
    {
      description:
        "Find a Run by the operation that created it, including retained history after a service restart.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({
        serviceInstanceId: z.uuid(),
        operationId: z.uuid(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async (input) =>
      toolResult({ run: await application.findRun(input) }),
    ),
  );
  server.registerTool(
    "list_runs",
    {
      description: "List active Runs and retained terminal history.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({ loomName: text.optional() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async ({ loomName }) =>
      toolResult({ runs: await application.listRuns(loomName) }),
    ),
  );
  server.registerTool(
    "answer_ask",
    {
      description:
        "Submit an exact human answer for the current Run/action and promptly return the resumed Run. Query get_run for later status. Never infer human consent. Questions require the complete answer array; confirmation requires isConfirmed and optional feedback.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({
        ...operation,
        runId: text,
        actionId: text,
        answer: z.json(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guard(async ({ runId, ...input }) =>
      toolResult({ ...(await application.admit("answer", input, runId)) }),
    ),
  );
  server.registerTool(
    "interact",
    {
      description:
        "Present one existing pending action to the human. Continue the same Run; does not create a Run. Cancel/decline leaves it waiting.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({
        ...operation,
        runId: text,
        actionId: text,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guard(
      async ({ runId, actionId, operationId, serviceInstanceId }, context) => {
        const view = await application.getRun(runId);
        if (view.status !== "waiting" || view.pendingAction?.id !== actionId)
          throw failure("CONFLICT", "This action is no longer pending.");
        const adapter = resolveIde(ide);
        const handled = await handlePendingAction(
          view,
          mcpPresenter(server, context, adapter),
          async (id, action, answer) =>
            admittedRun(
              await application.admit(
                "answer",
                { operationId, serviceInstanceId, actionId: action, answer },
                id,
              ),
            ),
        );
        return (
          handled.continuation ??
          toolResult({ run: handled.run, interaction: handled.interaction })
        );
      },
    ),
  );
  server.registerTool(
    "cancel_run",
    {
      description:
        "Explicitly stop one Run. Does not stop the service or undo committed data.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({ ...operation, runId: text }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    guard(async ({ runId, ...input }) =>
      toolResult({ ...(await application.admit("stop", input, runId)) }),
    ),
  );
  server.registerTool(
    "status",
    {
      description: "Read service identity and projected Loom/Run counts.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async () => toolResult({ service: await application.status() })),
  );
  server.registerTool(
    "get_artifact",
    {
      description:
        "Read the current committed Artifact using exactly one selector: {artifactId} alone, or {loomName, stageName} together. Never combine the two selectors. This is the latest value at query time, not a historical Run version. Missing values return null.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: artifactSelectorSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    guard(async (input) =>
      toolResult({
        artifact: await application.getArtifact(parseArtifactSelector(input)),
      }),
    ),
  );
  server.registerTool(
    "list_artifacts",
    {
      description:
        "List current committed Artifact metadata without business data. Optional Loom/Stage filters and pagination; default limit 50, maximum 200. Does not advance Runs.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: artifactQuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    guard(async (input) =>
      toolResult({
        artifacts: await application.listArtifacts(parseArtifactQuery(input)),
      }),
    ),
  );
  server.registerTool(
    "get_record",
    {
      description:
        "Read a committed Record by ID, including checking whether a failed finalize committed. Does not resume a failed Run.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({ recordId: text }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async ({ recordId }) =>
      toolResult({
        record: await application.getRecord(recordId),
      }),
    ),
  );
  server.registerTool(
    "mirror_list",
    {
      description: "List local immutable mirrors without Loom execution.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async () => toolResult({ mirrors: await application.listMirrors() })),
  );
  server.registerTool(
    "mirror_inspect",
    {
      description:
        "Inspect raw checkpoint, State, Storage, files and exclusions offline.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({ mirrorId: z.uuid() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async ({ mirrorId }) =>
      toolResult(await application.inspectMirror(mirrorId)),
    ),
  );
  server.registerTool(
    "mirror_restore",
    {
      description:
        "Restore a safe boundary into an independent prepared stopped project, paused until explicit resume.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: restoreMirrorSchema.omit({ sourceProject: true }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    guard(async (input) => toolResult(await application.restoreMirror(input))),
  );
  server.registerTool(
    "mirror_export",
    {
      description: "Export raw mirror trace into a new independent directory.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({
        traceId: z.uuid(),
        targetProject: z.string().min(1),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    guard(async ({ traceId, targetProject }) =>
      toolResult(await application.exportMirrors(traceId, targetProject)),
    ),
  );
  server.registerTool(
    "resume_run",
    {
      description:
        "Explicitly resume paused mirror execution. Reuse operationId after a lost response; scope completion requires a new explicit scope. Bind current serviceInstanceId and expectedRevision from get_run.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: resumeRunSchema.extend({ runId: z.string().min(1) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async ({ runId, ...input }) =>
      toolResult({ ...(await application.admit("resume", input, runId)) }),
    ),
  );
  server.registerTool(
    "get_operation",
    {
      description:
        "Query an original operation in its Service instance. An instance change is not evidence that no effects occurred.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject(operation),
      annotations: { readOnlyHint: true },
    },
    guard(async ({ serviceInstanceId, operationId }) =>
      toolResult({
        ...application.getOperation(serviceInstanceId, operationId),
      }),
    ),
  );
  server.registerTool(
    "pause_run",
    {
      description:
        "Request a pause after the active Step settles. Acceptance is distinct from the Run becoming paused.",
      _meta: { ui: { visibility: ["model"] } },
      inputSchema: z.strictObject({ ...operation, runId: text }),
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    guard(async ({ runId, ...input }) =>
      toolResult({ ...(await application.admit("pause", input, runId)) }),
    ),
  );
  await registerApps(server, application);
  return server;
}

function admittedRun(admission: Admission) {
  if (admission.receipt.status === "accepted" && admission.run)
    return admission.run;
  if (
    admission.receipt.status === "rejected" ||
    admission.receipt.status === "indeterminate"
  )
    throw failure(
      admission.receipt.error.code,
      admission.receipt.error.message,
    );
  throw failure(
    "BUSY",
    "The original operation is still pending. Query its receipt.",
  );
}
