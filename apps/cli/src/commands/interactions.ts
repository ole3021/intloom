import { answerRequest } from "../operations/respond.ts";
import {
  IntloomError,
  type InteractionRequest,
  type InteractionResponse,
  type JsonValue,
} from "@intloom/loom-sdk";
import { interactive } from "../ui/prompts.ts";
import type { CommandContext } from "../context.ts";

export async function runInteractionCommand(ctx: CommandContext) {
  const {
    operation,
    argument,
    output,
    client,
    required,
    string,
    exact,
    readJson,
  } = ctx;
  if (operation === "list") {
    exact(2);
    output(
      await client("listInteractions", [
        {
          runId: required(string("run"), "Specify --run."),
          ...(string("status") && {
            status: string("status") as InteractionRequest["status"],
          }),
        },
      ]),
    );
    return;
  }
  exact(3);
  const id = required(argument, "Specify requestId.");
  if (operation === "get") {
    output(await client("getInteraction", [id]));
    return;
  }
  if (operation !== "respond")
    throw new IntloomError(
      "INVALID_ARGUMENT",
      "Use interaction list, get or respond.",
    );
  const action = string("action"),
    raw = string("value");
  let response: InteractionResponse;
  if (action !== undefined) {
    if (raw !== undefined || (action !== "decline" && action !== "dismiss"))
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Choose --action decline|dismiss or --value.",
      );
    response = { action };
  } else if (raw !== undefined)
    response = { action: "submit", value: (await readJson(raw)) as JsonValue };
  else {
    if (!interactive())
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Provide --value or use an interactive terminal.",
      );
    const receipt = await answerRequest(ctx, id);
    process.stdout.write(
      receipt.requestStatus === "answered"
        ? `Answer submitted · Run ${receipt.runId} · ${receipt.continuation.status === "requested" ? "Continuation requested" : "Answer saved"}\n`
        : `Response recorded · Run ${receipt.runId} · Question pending\n`,
    );
    return;
  }
  output(
    await client("respondInteraction", [
      id,
      response,
      { source: { kind: "program", via: "cli" } },
    ]),
  );
}
