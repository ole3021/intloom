import { heading, wrapText } from "../ui/theme.ts";
import {
  IntloomError,
  type InteractionResponse,
  type ResponseSource,
} from "@intloom/loom-sdk";
import { menu, confirm, PromptCancelled } from "../ui/prompts.ts";
import { formValue, correctValue } from "../ui/form.ts";
import { reviewMaterials } from "./review-materials.ts";
import type { CommandContext } from "../context.ts";

export async function answerRequest(ctx: CommandContext, id: string) {
  const { request } = await ctx.client("getInteraction", [id]);
  if (request.status !== "pending")
    throw new IntloomError(
      "INTERACTION_NOT_PENDING",
      "This question is closed or has already been answered.",
    );
  const source: ResponseSource = {
    kind: process.env.INTLOOM_CLI_TEST === "1" ? "test" : "human",
    via: "cli",
  };
  const run = await ctx.client("getRun", [request.runId]);
  process.stderr.write(
    `${wrapText(
      [
        "",
        heading(
          process.stderr,
          request.kind === "approval" ? "Approval" : "Answer",
        ),
        `Run   ${run.id} · ${run.loom.id}@${run.loom.version}`,
        `Step  ${request.origin.stepPath?.join("/") ?? request.origin.componentId}`,
        "",
        `${request.kind === "approval" ? "Awaiting approval" : "Awaiting answer"} · ${request.message}`,
      ].join("\n"),
      process.stderr,
    )}\n`,
  );
  if (request.context !== undefined) await reviewMaterials(ctx, request);
  let response: InteractionResponse = { action: "dismiss" };
  try {
    if (request.kind === "approval") {
      const decision = await menu("Review this approval request", [
        { value: "defer", label: "Defer" },
        { value: "approve", label: "Approve" },
        { value: "reject", label: "Reject" },
      ]);
      return send(
        decision === "defer"
          ? { action: "dismiss" }
          : { action: "submit", value: { approved: decision === "approve" } },
      );
    }
    const action = await menu("Respond to this question", [
      { value: "submit", label: "Answer now" },
      { value: "dismiss", label: "Defer" },
      { value: "decline", label: "Decline" },
    ]);
    if (action === "decline") response = { action: "decline" };
    if (action === "submit") {
      let value = await formValue(request.answerSchema, "Answer");
      for (;;) {
        if (!(await confirm("Submit this answer?"))) break;
        try {
          return await send({ action: "submit", value });
        } catch (error) {
          value = await correctValue(
            error,
            "RESPONSE_INVALID",
            value,
            request.answerSchema,
          );
        }
      }
    }
  } catch (error) {
    if (!(error instanceof PromptCancelled)) throw error;
    await send(response);
    throw error;
  }
  return send(response);
  async function send(response: InteractionResponse) {
    const receipt = await ctx.client("respondInteraction", [
      id,
      response,
      { source },
    ]);
    if (receipt.continuation.status === "needs_attention")
      process.stderr.write(`${receipt.continuation.message}\n`);
    return receipt;
  }
}
