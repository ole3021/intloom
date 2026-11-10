import { randomUUID } from "node:crypto";
import {
  IntloomError,
  type JsonObject,
  type JsonValue,
  type InteractionResponse,
  type ResponseSource,
} from "@intloom/loom-sdk";
import {
  CLIENT_CAPABILITIES_META_KEY,
  inputRequired,
  type ClientCapabilities,
  type ElicitRequestFormParams,
  type ServerContext,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import type { ServiceClient } from "../service/protocol.ts";

function formSchema(
  schema: JsonObject,
): ElicitRequestFormParams["requestedSchema"] | undefined {
  if (
    schema.type !== "object" ||
    !schema.properties ||
    typeof schema.properties !== "object" ||
    Array.isArray(schema.properties)
  )
    return;
  if (
    Object.keys(schema).some(
      (key) =>
        ![
          "$schema",
          "type",
          "properties",
          "required",
          "additionalProperties",
          "description",
        ].includes(key),
    )
  )
    return;
  // Only constraints that the native form can faithfully express are accepted.
  for (const property of Object.values(schema.properties)) {
    if (!property || typeof property !== "object" || Array.isArray(property))
      return;
    const allowed = ["type", "title", "description", "default"];
    if (property.type === "string")
      allowed.push("enum", "minLength", "maxLength", "format");
    else if (property.type === "number" || property.type === "integer")
      allowed.push("minimum", "maximum");
    else if (property.type !== "boolean") return;
    if (Object.keys(property).some((key) => !allowed.includes(key))) return;
    if (
      property.format &&
      !["email", "uri", "date", "date-time"].includes(String(property.format))
    )
      return;
  }
  const { $schema: _dialect, ...form } = schema;
  return form as ElicitRequestFormParams["requestedSchema"];
}

export function interactionPresenter(
  client: ServiceClient,
  options: { dataDir: string; nativeResponseSource?: ResponseSource },
) {
  const rounds = new Map<string, { requestId: string; response?: unknown }>();
  const prompt = async (requestId: string, ctx: ServerContext) => {
    const state = ctx.mcpReq.requestState<string>();
    const round = state === undefined ? undefined : rounds.get(state);
    if (
      (state !== undefined && round?.requestId !== requestId) ||
      (!round && ctx.mcpReq.inputResponses)
    )
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Presentation round does not match this request.",
      );
    if (round?.response) return round.response;
    const current = await client("getInteraction", [requestId]);
    if (current.request.status !== "pending") return current;
    if (round && ctx.mcpReq.inputResponses) {
      const parsed = z
        .strictObject({
          answer: z.union([
            z.strictObject({
              action: z.literal("accept"),
              content: z.record(z.string(), z.unknown()),
            }),
            z.strictObject({ action: z.enum(["decline", "cancel"]) }),
          ]),
        })
        .safeParse(ctx.mcpReq.inputResponses);
      if (!parsed.success)
        throw new IntloomError(
          "RESPONSE_INVALID",
          "Expected this form's accept, decline or cancel response.",
        );
      const answer = parsed.data.answer;
      const response: InteractionResponse =
        answer.action === "accept"
          ? { action: "submit", value: answer.content as JsonValue }
          : { action: answer.action === "cancel" ? "dismiss" : "decline" };
      round.response = await client("respondInteraction", [
        requestId,
        response,
        {
          source: options.nativeResponseSource ?? { kind: "human", via: "mcp" },
        },
      ]);
      return round.response;
    }
    const capabilities = (
      ctx.mcpReq.envelope as Record<string, unknown> | undefined
    )?.[CLIENT_CAPABILITIES_META_KEY] as ClientCapabilities | undefined;
    const elicitation = capabilities?.elicitation;
    const supportsForm =
      elicitation &&
      (elicitation.form !== undefined || Object.keys(elicitation).length === 0);
    const schema = formSchema(current.request.answerSchema);
    if (!supportsForm || !schema)
      return {
        ...current,
        presentation: "fallback",
        reason: !supportsForm ? "form_not_supported" : "schema_not_supported",
        cli: {
          command: "intloom",
          args: ["interaction", "respond", requestId],
        },
        canRespondWithTool: current.request.responsePolicy === "any",
      };
    const handle = state ?? randomUUID();
    if (!round) rounds.set(handle, { requestId });
    return inputRequired({
      requestState: handle,
      inputRequests: {
        answer: inputRequired.elicit({
          mode: "form",
          message:
            current.request.message +
            (current.request.context === undefined
              ? ""
              : `\n\nContext:\n${JSON.stringify(current.request.context, null, 2)}`),
          requestedSchema: schema,
        }),
      },
    });
  };
  return {
    prompt,
    verify(state: string) {
      if (!rounds.has(state)) throw new Error("Unknown presentation round");
      return state;
    },
  };
}
