import { randomUUID } from "node:crypto";
import type * as z from "zod";
import type { CoreResult, CoreMeta } from "@intloom/kernel/operations";
import { readServiceResponse, requestTransportFailure } from "./response.ts";
import { errorView } from "../errors.ts";
import { connection } from "./discovery.ts";
import type { ProjectInput } from "./contracts.ts";
export async function request<T>(
  input: ProjectInput,
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<CoreResult<T>> {
  const meta: CoreMeta = {
    requestId: randomUUID(),
    ...(input?.serviceInstanceId
      ? { serviceInstanceId: input.serviceInstanceId }
      : {}),
    ...(input && "runId" in input ? { runId: String(input.runId) } : {}),
    ...(input && "operationId" in input
      ? { operationId: String(input.operationId) }
      : {}),
  };
  let sent = false;
  try {
    const trusted = await connection(
      input,
      meta,
      path.includes("/operations/"),
    );
    const signal = AbortSignal.timeout(10000);
    const payload = body === undefined ? {} : { body: JSON.stringify(body) };
    sent = true;
    const response = await fetch(new URL(path, trusted.url), {
      method: body === undefined ? "GET" : "POST",
      headers: { ...trusted.headers, "content-type": "application/json" },
      ...payload,
      redirect: "error",
      signal,
    }).catch((cause: unknown) => {
      throw requestTransportFailure(signal, cause);
    });
    return await readServiceResponse(response, schema, meta, signal);
  } catch (error) {
    const unknown = body !== undefined && sent;
    const safe = errorView(error);
    return {
      ok: false,
      error: unknown
        ? {
            code: "REQUEST_OUTCOME_UNKNOWN",
            message: `No valid operation result was received (${safe.code}). ${safe.message} Query the original operation before another submission.`,
            retryable: false,
          }
        : safe,
      outcome: unknown ? "unknown" : "not_applied",
      meta,
    };
  }
}
