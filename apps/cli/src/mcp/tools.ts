import { packageVersion } from "../version.ts";
import { getLogger } from "@intloom/utils";
import * as z from "zod";
import {
  McpServer,
  type CallToolResult,
  type InputRequiredResult,
  type ServerContext,
} from "@modelcontextprotocol/server";
import type { ProjectApplication } from "../application/project.ts";
import {
  artifactQuerySchema,
  artifactSelectorSchema,
  parseArtifactQuery,
  parseArtifactSelector,
} from "../application/artifacts.ts";
import { handlePendingAction } from "../interaction/handle-action.ts";
import { resolveIde } from "../ide/resolve.ts";
import { mcpPresenter } from "./interaction.ts";
import { toolFailure, toolResult } from "./results.ts";
import { failure } from "../errors.ts";
import { registerAgentTools } from "./agent-tools.ts";

const text = z.string().refine((value) => value.trim().length > 0);
const instructions =
  "Use flow once to create a Run. If waiting with pendingAgentCall, claim_agent_call using its id and a stable unique claimId. Execute the task instructions and Skills using only its declared call_agent_tool operations and read_agent_asset. Keep ownerToken private. Then complete_agent_call with raw output matching outputSchema, or fail_agent_call if unable. Follow the returned Run until terminal. Client reasoning stays in the IDE; never configure or call a service model as a fallback. If waiting with pendingAction, call interact with the existing runId and pendingAction.id. If native forms are unavailable, ask the human and submit their exact answer via answer_ask. Agent execution does not authorize answering human questions or confirmation. Never invent answers or confirmations. Cancelling a form leaves the Run waiting; cancel_run explicitly stops it. Retry queries/claims/Tool calls/completion with their original identities and inputs, never flow creation. Completed/failed are terminal; failed does not prove a transaction was uncommitted.";

/** All IDEs share Tool definitions and business entry points; protocol objects may be rebuilt while the application is reused. */
export function createToolServer(
  application: ProjectApplication,
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
    "flow",
    {
      description:
        "Create one Workflow Run from the user's intent. Returns at the first wait or terminal state. Do not retry to answer a pending question.",
      inputSchema: z.strictObject({ flowName: text, intent: text }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guard(async ({ flowName, intent }) =>
      toolResult({ run: await application.flow(flowName, intent) }),
    ),
  );
  server.registerTool(
    "list_workflows",
    {
      description: "List available Workflows and initialization diagnostics.",
      inputSchema: z.strictObject({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async () =>
      toolResult({ workflows: await application.listWorkflows() }),
    ),
  );
  server.registerTool(
    "get_run",
    {
      description: "Read the current Run snapshot without advancing it.",
      inputSchema: z.strictObject({ runId: text }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async ({ runId }) =>
      toolResult({ run: await application.getRun(runId) }),
    ),
  );
  server.registerTool(
    "list_runs",
    {
      description: "List this service's in-process Runs.",
      inputSchema: z.strictObject({ flowName: text.optional() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async ({ flowName }) =>
      toolResult({ runs: await application.listRuns(flowName) }),
    ),
  );
  server.registerTool(
    "answer_ask",
    {
      description:
        "Submit an exact human answer for the current Run/action. Never infer human consent. Questions require the complete answer array; confirmation requires isConfirmed and optional feedback.",
      inputSchema: z.strictObject({
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
    guard(async ({ runId, actionId, answer }) =>
      toolResult({
        run: await application.answerAsk(runId, actionId, answer),
      }),
    ),
  );
  server.registerTool(
    "interact",
    {
      description:
        "Present one existing pending action to the human. Continue the same Run; does not create a Run. Cancel/decline leaves it waiting.",
      inputSchema: z.strictObject({ runId: text, actionId: text }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guard(async ({ runId, actionId }, context) => {
      const view = await application.getRun(runId);
      if (view.status !== "waiting" || view.pendingAction?.id !== actionId)
        throw failure("CONFLICT", "This action is no longer pending.");
      const adapter = resolveIde(ide);
      const handled = await handlePendingAction(
        view,
        mcpPresenter(server, context, adapter),
        (id, action, answer) => application.answerAsk(id, action, answer),
      );
      return (
        handled.continuation ??
        toolResult({ run: handled.run, interaction: handled.interaction })
      );
    }),
  );
  server.registerTool(
    "cancel_run",
    {
      description:
        "Explicitly stop one Run. Does not stop the service or undo committed data.",
      inputSchema: z.strictObject({ runId: text }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    guard(async ({ runId }) =>
      toolResult({ run: await application.cancelRun(runId) }),
    ),
  );
  server.registerTool(
    "status",
    {
      description: "Read service identity and projected Workflow/Run counts.",
      inputSchema: z.strictObject({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async () => toolResult({ service: await application.status() })),
  );
  server.registerTool(
    "get_artifact",
    {
      description:
        "Read the current committed Artifact by artifactId or flowName and stageName. This is the latest value at query time, not a historical Run version. Missing values return null.",
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
        "List current committed Artifact metadata without business data. Optional Workflow/Stage filters and pagination; default limit 50, maximum 200. Does not advance Runs.",
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
      inputSchema: z.strictObject({ recordId: text }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async ({ recordId }) =>
      toolResult({
        record: await application.getRecord(recordId),
      }),
    ),
  );
  return server;
}
