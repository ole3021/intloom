import {
  inputRequired,
  inputResponse,
  type ElicitRequestFormParams,
  type InputRequiredResult,
  type McpServer,
  type ServerContext,
} from "@modelcontextprotocol/server";
import type { ActionForm } from "../interaction/forms.ts";
import type { ActionPresenter } from "../interaction/contracts.ts";
import type { IdeAdapter } from "../ide/contracts.ts";
import { failure } from "../errors.ts";

/** Binds the current client per call; protocol replies reference existing actions without creating another waiting record. */
export function mcpPresenter(
  server: McpServer,
  context: ServerContext,
  adapter: IdeAdapter | undefined,
): ActionPresenter<InputRequiredResult> {
  return {
    async present(action) {
      // The SDK normalizes both protocols' negotiated capabilities through this accessor; namespace-specific _meta parsing is unnecessary.
      const capabilities = server.server.getClientCapabilities();
      const elicitation = capabilities?.elicitation;
      if (
        !adapter ||
        !elicitation ||
        !("form" in elicitation || Object.keys(elicitation).length === 0)
      )
        return { kind: "unavailable" };
      const form = adapter.createForm(action);
      const requestedSchema = wireFormSchema(form);
      let response: {
        action: "accept" | "decline" | "cancel";
        content?: Record<string, unknown> | undefined;
      };
      if (context.mcpReq.envelope) {
        const received = inputResponse(
          context.mcpReq.inputResponses,
          action.id,
        );
        if (received.kind === "missing")
          return {
            kind: "input_required",
            continuation: inputRequired({
              inputRequests: {
                [action.id]: inputRequired.elicit({
                  mode: "form",
                  message: form.message,
                  requestedSchema,
                }),
              },
            }),
          };
        if (received.kind !== "elicit")
          throw failure(
            "INVALID_REQUEST",
            "The pending action requires a form reply.",
          );
        response = received;
      } else {
        try {
          response = await context.mcpReq.elicitInput(
            {
              mode: "form",
              message: form.message,
              requestedSchema,
            },
            { timeout: 300_000 },
          );
        } catch (cause) {
          if (context.mcpReq.signal.aborted) return { kind: "dismissed" };
          throw failure(
            "CLI_INTERACTION_UNAVAILABLE",
            "The client could not present the question. The Run remains waiting; use answer_ask with the current action ID.",
            cause,
          );
        }
      }
      if (response.action !== "accept") return { kind: "dismissed" };
      try {
        return { kind: "answered", answer: form.decode(response.content) };
      } catch (cause) {
        throw failure(
          "INVALID_REQUEST",
          "The form reply is invalid. The current action has not been consumed.",
          cause,
        );
      }
    },
  };
}

/** MCP forms support a restricted Schema subset; form.decode still strictly rejects extra fields. */
export function wireFormSchema(
  form: ActionForm,
): ElicitRequestFormParams["requestedSchema"] {
  const schema = JSON.parse(
    JSON.stringify(form.schema.toJSONSchema({ target: "draft-7" })),
  ) as ElicitRequestFormParams["requestedSchema"];
  return {
    type: "object",
    properties: schema.properties,
    ...(schema.required ? { required: schema.required } : {}),
  };
}
