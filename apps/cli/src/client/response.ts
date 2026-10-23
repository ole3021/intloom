import type { ZodType } from "zod";
import {
  coreResultSchema,
  type CoreMeta,
  type CoreResult,
} from "@intloom/kernel/operations";
import { failure } from "../errors.ts";

function unavailable(response: Response) {
  return failure(
    "CLI_SERVICE_UNAVAILABLE",
    `The Service rejected the request (HTTP ${response.status}) without a valid operation result.`,
  );
}

export function requestTransportFailure(signal: AbortSignal, cause: unknown) {
  return signal.aborted
    ? failure(
        "CLI_SERVICE_TIMEOUT",
        "The Service request timed out. Check the original operation before submitting again.",
        cause,
      )
    : failure(
        "CLI_SERVICE_OFFLINE",
        "The Service connection failed. Check intloom status and the original operation before submitting again.",
        cause,
      );
}

/** Validate the envelope before interpreting an HTTP error as a transport failure. */
export async function readServiceResponse<T>(
  response: Response,
  schema: ZodType<T>,
  meta: CoreMeta,
  signal: AbortSignal,
): Promise<CoreResult<T>> {
  const rejected =
    response.status === 401 ||
    response.status === 403 ||
    response.status >= 500;
  const json =
    response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() === "application/json";
  if (!json) {
    if (response.status === 404)
      throw failure(
        "CLI_SERVICE_PROTOCOL_MISMATCH",
        "The Service API response is incompatible with this CLI (HTTP 404). Check the CLI and Service versions; stop and start the Service to reload it.",
      );
    if (!response.ok) throw unavailable(response);
    throw failure(
      "CLI_RESULT_INVALID",
      "The Service response must contain a JSON operation result.",
    );
  }
  const text = await response.text().catch((cause: unknown) => {
    throw requestTransportFailure(signal, cause);
  });
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    if (rejected) throw unavailable(response);
    throw failure(
      "CLI_RESULT_INVALID",
      "The Service response is not valid JSON.",
    );
  }
  const parsed = coreResultSchema(schema).safeParse(value);
  if (!parsed.success) {
    if (rejected) throw unavailable(response);
    throw failure(
      "CLI_RESULT_INVALID",
      "The Service response has an invalid operation result shape.",
    );
  }
  const result = parsed.data;
  if (
    result.meta.serviceInstanceId !== meta.serviceInstanceId ||
    result.meta.projectRoot !== meta.projectRoot ||
    result.meta.requestId !== meta.requestId
  )
    throw failure(
      "CLI_RESULT_INVALID",
      "The response does not match the requested project and instance.",
    );
  if (!response.ok && result.ok) throw unavailable(response);
  return result;
}
