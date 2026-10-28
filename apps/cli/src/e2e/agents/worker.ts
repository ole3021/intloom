import { randomUUID } from "node:crypto";
import type { PublicSchema } from "@mastra/core/schema";
import { createTool, type Tool } from "@mastra/core/tools";
import * as z from "zod";
import { E2eError, type Configuration, type Models } from "../contracts.ts";
import type { Evidence } from "../evidence.ts";
import type { McpDriver } from "../drivers/mcp.ts";
import { runAgent } from "../agent.ts";
import { toolSchema } from "../schema.ts";

const taskSchema = z.object({
  instructions: z.string(),
  input: z.json().optional(),
  outputSchema: z.json(),
  skills: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      content: z.string(),
      assets: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
  ),
  tools: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      inputSchema: z.json(),
    }),
  ),
});
export async function executeWorker(input: {
  driver: McpDriver;
  runId: string;
  callId: string;
  models: Models;
  config: Configuration;
  evidence: Evidence;
  environment: NodeJS.ProcessEnv;
  signal: AbortSignal;
}) {
  const { driver, runId, callId, evidence } = input;
  const controller = new AbortController();
  const signal = AbortSignal.any([input.signal, controller.signal]);
  let failure: unknown;
  const host = async (name: string, args: Record<string, unknown>) => {
    try {
      return await driver.call(name, args, signal);
    } catch (cause) {
      // Only a rejected input can be corrected. An uncertain side effect must not be replayed.
      if (!(cause instanceof E2eError && cause.code === "INVALID_REQUEST")) {
        failure = cause;
        controller.abort(cause);
      }
      throw cause;
    }
  };
  const claim = z
    .object({ task: taskSchema, ownerToken: z.string() })
    .parse(
      await driver.call(
        "claim_agent_call",
        { runId, callId, claimId: randomUUID() },
        signal,
      ),
    );
  evidence.secrets.push(claim.ownerToken);
  const owner = { runId, callId, ownerToken: claim.ownerToken };
  const tools: Record<string, Tool> = Object.create(null);
  for (const definition of claim.task.tools)
    tools[definition.id] = createTool({
      id: definition.id,
      description: definition.description,
      inputSchema: toolSchema(definition.inputSchema),
      strict: false,
      execute: async (value) =>
        z.object({ output: z.json() }).parse(
          await host("call_agent_tool", {
            ...owner,
            toolCallId: randomUUID(),
            toolId: definition.id,
            input: value,
          }),
        ).output,
    });
  let assetToolName = "e2e_read_skill_asset";
  for (let index = 1; Object.hasOwn(tools, assetToolName); index++)
    assetToolName = `e2e_read_skill_asset_${index}`;
  tools[assetToolName] = createTool({
    id: assetToolName,
    description: "Read a host-declared Skill asset.",
    inputSchema: toolSchema(z.toJSONSchema(z.object({ assetId: z.string() }))),
    execute: async (value) =>
      host("read_agent_asset", {
        ...owner,
        assetId: z.object({ assetId: z.string() }).parse(value).assetId,
      }),
  });
  try {
    const output = await runAgent({
      id: `loom-agent-${callId}`,
      model: input.models.worker ?? input.models.user,
      instructions: `${claim.task.instructions}\n\nBusiness input: ${JSON.stringify(claim.task.input ?? null)}\n\nHost Skills:\n${JSON.stringify(claim.task.skills)}\nApply these already-loaded Skills. Use ${assetToolName} to read their declared assets. Use only host Tools for business operations. You cannot answer or confirm user actions. Return the exact declared output through the client completion Tool.\nOutput Schema:\n${JSON.stringify(claim.task.outputSchema)}`,
      prompt: "Execute the assigned Loom Agent task.",
      tools,
      outputSchema: claim.task.outputSchema as PublicSchema,
      taskCompletion: true,
      maxSteps: input.config.limits.maxAgentSteps,
      connectionTimeoutMs: input.config.limits.modelConnectionTimeoutMs,
      connectionRetries: input.config.limits.modelConnectionRetries,
      idleTimeoutMs: input.config.limits.modelIdleTimeoutMs,
      evidence,
      signal,
      environment: input.environment,
    });
    if (failure) throw failure;
    await driver.call(
      "complete_agent_call",
      { ...owner, result: output },
      signal,
    );
  } catch (cause) {
    if (!input.signal.aborted)
      await driver
        .call(
          "fail_agent_call",
          {
            ...owner,
            message: "E2E client task failed; inspect the preserved evidence.",
          },
          input.signal,
        )
        .catch(() => {});
    throw failure ?? cause;
  }
}
