import { randomUUID } from "node:crypto";
import { admissionSchema } from "@intloom/kernel/operations";
import type { LoomInput } from "@intloom/loom-sdk";
import { packageVersion } from "../version.ts";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type { ReadonlyJsonValue } from "@intloom/loom-sdk";
import * as z from "zod";
import { failure, errorView } from "../errors.ts";
import { storedRecordSchema } from "@intloom/kernel/operations";
import {
  artifactPageSchema,
  parseArtifactQuery,
  parseArtifactSelector,
  storedArtifactSchema,
  type ArtifactQuery,
  type ArtifactSelector,
} from "@intloom/kernel/operations";
import {
  errorViewSchema,
  runViewSchema,
  loomViewSchema,
} from "@intloom/kernel/host";
import type {
  ProjectClient,
  ProjectConnection,
  ProjectClientOptions,
} from "./contracts.ts";

/** Connects without reading local files or selecting an IDE presentation policy. */
export async function connectProjectClient(
  connection: ProjectConnection,
  options: ProjectClientOptions = {},
): Promise<ProjectClient> {
  const endpoint = z
    .strictObject({
      url: z.url().refine((value) => {
        const url = new URL(value);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.hash
        );
      }),
      token: z
        .string()
        .min(1)
        .regex(/^[A-Za-z0-9_-]+$/u),
    })
    .safeParse(connection);
  const settings = z
    .strictObject({
      requestId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,80}$/u)
        .optional(),
    })
    .safeParse(options);
  if (!endpoint.success || !settings.success)
    throw failure(
      "INVALID_REQUEST",
      "Invalid project connection or client options.",
    );
  const client = new Client({
    name: "intloom-project-client",
    version: packageVersion,
  });
  const transport = new StreamableHTTPClientTransport(
    new URL(endpoint.data.url),
    {
      requestInit: {
        headers: {
          authorization: `Bearer ${endpoint.data.token}`,
          ...(settings.data.requestId
            ? { "x-intloom-request-id": settings.data.requestId }
            : {}),
        },
        redirect: "error",
      },
    },
  );
  try {
    await client.connect(transport, { timeout: 10_000 });
  } catch (cause) {
    await client.close().catch(() => undefined);
    throw failure(
      "PROJECT_CONNECTION_FAILED",
      "Could not connect to the project service.",
      cause,
    );
  }
  let closing: Promise<void> | undefined;
  async function call<T>(
    name: string,
    args: Record<string, unknown>,
    schema: z.ZodType<T>,
    knownRunId?: string,
  ): Promise<T> {
    if (closing)
      throw failure("PROJECT_CLIENT_CLOSED", "The project client is closed.");
    // Timeouts and disconnects do not replay mutations or implicitly cancel Runs; use runs/attach to inspect and resume.
    const result = await client
      .callTool({ name, arguments: args }, { timeout: 300_000 })
      .catch((cause: unknown) => {
        throw failure(
          "PROJECT_REQUEST_FAILED",
          knownRunId
            ? `The request outcome is unknown for Run ${knownRunId}. Query get_run or attach with this Run ID; do not repeat the mutation.`
            : name === "run"
              ? "The run result is unknown and no Run ID was received. Inspect list_runs and logs before considering another run; requestId is only for log correlation."
              : "The request did not return a confirmed result. Query runs/attach or the committed Record before repeating an execution.",
          cause,
        );
      });
    let data: unknown;
    try {
      data =
        result.structuredContent ??
        JSON.parse(
          result.content.find((item) => item.type === "text")?.text ?? "null",
        );
    } catch (cause) {
      throw failure(
        "PROJECT_RESPONSE_INVALID",
        "The project service returned an invalid response.",
        cause,
      );
    }
    if (result.isError) {
      const parsed = z.strictObject({ error: errorViewSchema }).safeParse(data);
      if (!parsed.success)
        throw failure(
          "PROJECT_RESPONSE_INVALID",
          "The project service returned an invalid error response.",
        );
      throw failure(
        parsed.data.error.code,
        parsed.data.error.message,
        undefined,
        parsed.data.error.retryable,
      );
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw failure(
        "PROJECT_RESPONSE_INVALID",
        "The project service returned an invalid response.",
        parsed.error,
      );
    return parsed.data;
  }
  const oneRun = z.strictObject({ run: runViewSchema });
  const status = await call(
    "status",
    {},
    z.object({ service: z.object({ instanceId: z.uuid() }) }),
  ).catch(async (cause) => {
    await client.close().catch(() => {});
    throw cause;
  });
  const serviceInstanceId = status.service.instanceId;
  async function mutate(
    name: string,
    args: Record<string, unknown>,
    runId?: string,
  ) {
    const operationId = randomUUID();
    const lookup = `Query get_operation with operationId ${operationId} and serviceInstanceId ${serviceInstanceId} before another mutation.`;
    const data = await call(
      name,
      { ...args, operationId, serviceInstanceId },
      admissionSchema,
      runId,
    ).catch((cause) => {
      const error = errorView(cause);
      throw failure(
        error.code,
        `${error.message} ${lookup}`,
        cause,
        error.retryable,
      );
    });
    if (data.receipt.status === "accepted")
      return (
        data.run ??
        (
          await call(
            "get_run",
            { runId: data.receipt.runId },
            oneRun,
            data.receipt.runId,
          )
        ).run
      );
    if (
      data.receipt.status === "rejected" ||
      data.receipt.status === "indeterminate"
    )
      throw failure(
        data.receipt.error.code,
        `${data.receipt.error.message}${data.receipt.status === "indeterminate" ? ` ${lookup}` : ""}`,
      );
    throw failure(
      "OPERATION_PENDING",
      `Query operation ${operationId} in Service ${serviceInstanceId} before resubmitting.`,
    );
  }
  return {
    async run(loomName: string, input: LoomInput) {
      return mutate("run", { loomName, input });
    },
    async getRun(runId: string) {
      return (await call("get_run", { runId }, oneRun, runId)).run;
    },
    async answerAsk(
      runId: string,
      actionId: string,
      answer: ReadonlyJsonValue,
    ) {
      return mutate("answer_ask", { runId, actionId, answer }, runId);
    },
    async cancelRun(runId: string) {
      return mutate("cancel_run", { runId }, runId);
    },
    async listRuns(loomName?: string) {
      return (
        await call(
          "list_runs",
          loomName === undefined ? {} : { loomName },
          z.strictObject({ runs: z.array(runViewSchema) }),
        )
      ).runs;
    },
    async listLooms() {
      return (
        await call(
          "list_looms",
          {},
          z.strictObject({ looms: z.array(loomViewSchema) }),
        )
      ).looms;
    },
    async getArtifact(selector: ArtifactSelector) {
      return (
        await call(
          "get_artifact",
          { ...parseArtifactSelector(selector) },
          z.strictObject({ artifact: storedArtifactSchema.nullable() }),
        )
      ).artifact;
    },
    async listArtifacts(query: ArtifactQuery = {}) {
      return (
        await call(
          "list_artifacts",
          { ...parseArtifactQuery(query) },
          z.strictObject({ artifacts: artifactPageSchema }),
        )
      ).artifacts;
    },
    async getRecord(recordId: string) {
      return (
        await call(
          "get_record",
          { recordId },
          z.strictObject({ record: storedRecordSchema.nullable() }),
        )
      ).record;
    },
    close() {
      closing ??= (async () => {
        // The service may exit first; releasing the connection neither changes the Run nor treats disconnection as mutation failure.
        try {
          if (transport.sessionId) await transport.terminateSession();
        } catch {
          /* session may already be gone */
        } finally {
          await client.close();
        }
      })();
      return closing;
    },
  };
}
