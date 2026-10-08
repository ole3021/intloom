import { packageVersion } from "../version.ts";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type { ReadonlyJsonValue } from "@intloom/kernel";
import * as z from "zod";
import { failure } from "../errors.ts";
import { storedRecordSchema } from "../application/records.ts";
import {
  artifactPageSchema,
  parseArtifactQuery,
  parseArtifactSelector,
  storedArtifactSchema,
  type ArtifactQuery,
  type ArtifactSelector,
} from "../application/artifacts.ts";
import {
  errorViewSchema,
  runViewSchema,
  workflowViewSchema,
} from "../service/contracts.ts";
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
  ): Promise<T> {
    if (closing)
      throw failure("PROJECT_CLIENT_CLOSED", "The project client is closed.");
    // Timeouts and disconnects do not replay mutations or implicitly cancel Runs; use runs/attach to inspect and resume.
    const result = await client
      .callTool({ name, arguments: args }, { timeout: 300_000 })
      .catch((cause: unknown) => {
        throw failure(
          "PROJECT_REQUEST_FAILED",
          "The request did not return a confirmed result. Query runs/attach or the committed Record before repeating an execution.",
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
  return {
    async flow(flowName: string, intent: string) {
      return (await call("flow", { flowName, intent }, oneRun)).run;
    },
    async getRun(runId: string) {
      return (await call("get_run", { runId }, oneRun)).run;
    },
    async answerAsk(
      runId: string,
      actionId: string,
      answer: ReadonlyJsonValue,
    ) {
      return (await call("answer_ask", { runId, actionId, answer }, oneRun))
        .run;
    },
    async cancelRun(runId: string) {
      return (await call("cancel_run", { runId }, oneRun)).run;
    },
    async listRuns(flowName?: string) {
      return (
        await call(
          "list_runs",
          flowName === undefined ? {} : { flowName },
          z.strictObject({ runs: z.array(runViewSchema) }),
        )
      ).runs;
    },
    async listWorkflows() {
      return (
        await call(
          "list_workflows",
          {},
          z.strictObject({ workflows: z.array(workflowViewSchema) }),
        )
      ).workflows;
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
