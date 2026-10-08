import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ProjectApplication } from "../application/project.ts";
import { toolFailure, toolResult } from "./results.ts";

const identity = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => value.trim().length > 0);
const ref = z.strictObject({ runId: identity, callId: identity });
const owner = ref.extend({ ownerToken: identity });

/** All IDE profiles use the same application operations and ownership protocol. */
export function registerAgentTools(
  server: McpServer,
  application: ProjectApplication,
): void {
  function register<T extends z.ZodRawShape>(
    name: string,
    description: string,
    schema: z.ZodObject<T>,
    readOnly: boolean,
    operation: (
      input: z.infer<z.ZodObject<T>>,
    ) => Promise<Record<string, unknown>>,
  ) {
    server.registerTool(
      name,
      {
        description,
        inputSchema: schema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (input) => {
        try {
          return toolResult(await operation(input));
        } catch (cause) {
          return toolFailure(cause);
        }
      },
    );
  }
  register(
    "get_agent_call",
    "Read the current pending Agent task and Tool receipt summary. Does not claim it or expose owner credentials.",
    ref,
    true,
    async (request) => ({ agentCall: await application.getAgentCall(request) }),
  );
  register(
    "claim_agent_call",
    "Claim the pending Agent task. Generate a unique claimId and retain it for reconnect/retry; another claimant receives CONFLICT. Retain ownerToken privately for subsequent calls.",
    ref.extend({ claimId: identity }),
    false,
    (request) => application.claimAgentCall(request),
  );
  register(
    "call_agent_tool",
    "Execute one declared business Tool in the host. Generate a toolCallId per operation; retry with the SAME ID and input to read its receipt without repeating effects. Tools are serial. Never mutate project State outside these Tools.",
    owner.extend({ toolCallId: identity, toolId: identity, input: z.json() }),
    false,
    async (request) => ({ output: await application.callAgentTool(request) }),
  );
  register(
    "read_agent_asset",
    "Read a Skill attachment by its task-provided assetId. Returns utf8 or base64 content; never accepts a filesystem path.",
    owner.extend({ assetId: identity }),
    true,
    (request) => application.readAgentAsset(request),
  );
  register(
    "complete_agent_call",
    "Submit the raw final JSON matching the task outputSchema AFTER all Tools finish. The host validates once and continues the original Run. Follow its next pendingAgentCall or pendingAction; never create another flow to continue.",
    owner.extend({ result: z.json() }),
    false,
    async (request) => ({ run: await application.completeAgentCall(request) }),
  );
  register(
    "fail_agent_call",
    "Report that you cannot execute the claimed task. Ends this Run as failed without undoing prior effects. Do not invent a successful result.",
    owner.extend({ message: z.string().min(1).max(4096) }),
    false,
    async (request) => ({ run: await application.failAgentCall(request) }),
  );
}
