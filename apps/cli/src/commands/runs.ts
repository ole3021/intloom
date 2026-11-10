import assert from "node:assert/strict";
import { interactive, choose } from "../ui/prompts.ts";
import { answerRequest } from "../operations/respond.ts";
import { watchRun } from "../ui/run-observer.ts";
import { observationExitCode } from "./observation-result.ts";
import { IntloomError, type JsonValue } from "@intloom/loom-sdk";
import type { CommandContext } from "../context.ts";
export async function handleRuns(ctx: CommandContext) {
  const {
    operation,
    argument,
    output,
    client,
    required,
    string,
    count,
    exact,
    readJson,
  } = ctx;
  const direct = {
    start: "startRun",
    stop: "cancelRun",
  } as const;
  if (operation && Object.hasOwn(direct, operation)) {
    exact(3);
    const method = direct[operation as keyof typeof direct];
    const id = required(argument, "Specify runId.");
    const receipt = await (method === "cancelRun"
      ? client(method, [id, string("reason")])
      : client(method, [id]));
    if (
      method === "cancelRun" &&
      ["running", "waiting", "stopping"].includes(
        (receipt as import("@intloom/loom-sdk").RunControlReceipt).run.status,
      )
    ) {
      const observed = await watchRun(
        { ...ctx, observation: { ...ctx.observation, until: "terminal" } },
        id,
        "status",
      );
      process.exitCode = observationExitCode(observed, "status");
      output({ ...receipt, run: observed.run });
    } else output(receipt);
    return;
  }
  if (operation === "events") {
    exact(3);
    const after = count("after"),
      limit = count("limit");
    output(
      await client("listRunEvents", [
        {
          runId: required(argument, "Specify runId."),
          ...(after === undefined ? {} : { after }),
          ...(limit === undefined ? {} : { limit }),
        },
      ]),
    );
    return;
  }
  if (operation === "resume") {
    exact(3);
    let requestId = string("request"),
      waitId = string("wait"),
      value = string("value");
    if (!requestId && !waitId && value === undefined && interactive()) {
      const run = await client("getRun", [
        required(argument, "Specify runId."),
      ]);
      if (run.status !== "waiting" || !run.waits.length)
        throw new IntloomError(
          "RUN_NOT_WAITING",
          "This Run has no wait to resume. Use intloom status <runId> to inspect it.",
        );
      const wait =
        run.waits[
          await choose(
            "Select a wait to continue",
            run.waits.map(
              (wait) =>
                `${wait.kind} · ${wait.origin.componentId} · ${wait.waitId}`,
            ),
          )
        ];
      assert.ok(wait);
      if (wait.requestId) {
        const { request } = await client("getInteraction", [wait.requestId]);
        if (request.status === "pending") {
          output(await answerRequest(ctx, request.id));
          return;
        }
        requestId = wait.requestId;
      } else waitId = wait.waitId;
    }
    if (
      Boolean(requestId) === Boolean(waitId) ||
      (requestId && value !== undefined)
    )
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Choose --request or --wait; only external waits accept --value.",
      );
    output(
      await client("resumeRun", [
        {
          runId: required(argument, "Specify runId."),
          ...(requestId
            ? { requestId }
            : {
                waitId: waitId as string,
                ...(value === undefined
                  ? {}
                  : {
                      resumeData: (await readJson(value)) as JsonValue,
                    }),
              }),
        },
      ]),
    );
    return;
  }
  exact(operation === "create" || argument ? 3 : 2);
  const { executeLoom } = await import("../operations/execute.ts");
  const observed = await executeLoom(
    ctx,
    required(
      operation === "create" ? argument : operation,
      "Specify a Loom selector.",
    ),
    {
      createOnly: operation === "create",
      ...(operation !== "create" && argument ? { command: argument } : {}),
    },
  );
  if (observed) process.exitCode = observationExitCode(observed);
}
