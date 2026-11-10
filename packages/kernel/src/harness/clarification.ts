import {
  defineTool,
  IntloomError,
  type AgentDefinition,
  type JsonValue,
  type PromptContext,
} from "@intloom/loom-sdk";
import { copyJson } from "@intloom/loom-sdk/json";
import { z } from "zod";
import type { AcceptedResume } from "../lifecycle/run-contracts.ts";

/** A question closes the current turn. A new session receives the original rendered
 * task, completed tool receipts and the answers without re-entering the author prompt. */
export async function clarificationTurn(
  agent: AgentDefinition,
  input: unknown,
  ctx: PromptContext,
  resume?: AcceptedResume,
) {
  const prompt = resume
    ? String(resume.checkpoint.engineRef.prompt)
    : await agent.prompt({ inputData: input, context: ctx });
  const history: JsonValue[] = resume
    ? [
        ...(resume.checkpoint.engineRef.history as JsonValue[]),
        resume.data === undefined ? {} : { answer: resume.data },
      ]
    : [];
  let question: string | undefined;
  if (agent.tools?.some((tool) => tool.id === "askUser"))
    throw new IntloomError(
      "COMPONENT_INVALID",
      "askUser is reserved for user clarification.",
    );
  const ask = defineTool({
    id: "askUser",
    description:
      "Ask for a missing piece of business input. End this turn and wait for the answer.",
    inputSchema: z.strictObject({ question: z.string().min(1) }),
    outputSchema: z.string(),
    execute: ({ inputData }) => {
      question = inputData.question;
      return "Waiting for the caller. End this turn.";
    },
  });
  const instructions =
    typeof agent.instructions === "string"
      ? agent.instructions
      : await ctx.resources.readText(agent.instructions);
  const definition: AgentDefinition = {
    ...agent,
    tools: [...(agent.tools ?? []), ask],
    instructions:
      instructions +
      "\nIf essential information is missing, call askUser and stop. On continuation use the caller's answers and the completed tool results.",
    prompt: () =>
      history.length
        ? JSON.stringify({ task: prompt, completedTurns: history })
        : prompt,
  };
  return {
    definition,
    waiting: () => question !== undefined,
    note(tool: string, args: unknown, result: unknown) {
      if (tool !== "askUser")
        history.push(
          copyJson({ tool, args, result }, "completed tool receipt"),
        );
    },
    snapshot() {
      return question === undefined
        ? undefined
        : {
            question,
            state: {
              kind: "agent-question",
              prompt,
              history: [...history, { question }],
            },
          };
    },
  };
}
