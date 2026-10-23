import { randomUUID } from "node:crypto";
import {
  coreResultSchema,
  projectEventSchema,
  type CoreResult,
  type CoreMeta,
  type ProjectEvent,
} from "@intloom/kernel/operations";
import { errorView, failure } from "../errors.ts";
import { connection } from "./discovery.ts";
import type { ProjectInput, ObserveOptions } from "./contracts.ts";
export async function* observe(
  input: ProjectInput,
  path: string,
  options: ObserveOptions = {},
): AsyncIterable<CoreResult<ProjectEvent>> {
  const meta: CoreMeta = {
    requestId: randomUUID(),
    ...(input.serviceInstanceId
      ? { serviceInstanceId: input.serviceInstanceId }
      : {}),
  };
  for (let attempt = 0; attempt < 4 && !options.signal?.aborted; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const trusted = await connection(
        {
          ...input,
          ...(meta.serviceInstanceId
            ? { serviceInstanceId: meta.serviceInstanceId }
            : {}),
        },
        meta,
      );
      if (options.signal?.aborted) return;
      timer = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(new URL(path, trusted.url), {
        headers: trusted.headers,
        redirect: "error",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (
        !response.ok ||
        !response.body ||
        !response.headers.get("content-type")?.startsWith("text/event-stream")
      ) {
        if (
          response.headers.get("content-type")?.startsWith("application/json")
        ) {
          const failureResult = coreResultSchema(projectEventSchema).parse(
            await response.json(),
          );
          if (!failureResult.ok) {
            yield failureResult;
            return;
          }
        }
        throw failure(
          "CLI_SERVICE_UNAVAILABLE",
          "The Service did not accept observation.",
        );
      }
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of response.body) {
        buffer = (buffer + decoder.decode(chunk, { stream: true })).replace(
          /\r\n/gu,
          "\n",
        );
        for (;;) {
          const end = buffer.indexOf("\n\n");
          if (end < 0) break;
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = block
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (!data) continue;
          const result = coreResultSchema(projectEventSchema).parse(
            JSON.parse(data),
          );
          if (result.meta.serviceInstanceId !== meta.serviceInstanceId)
            throw failure(
              "SERVICE_INSTANCE_CHANGED",
              "The observation instance changed.",
            );
          yield result;
          if (!result.ok || result.data.type === "service_closing") return;
        }
        if (buffer.length > 8 * 1024 * 1024)
          throw failure(
            "CLI_RESULT_INVALID",
            "An observation frame exceeded its limit.",
          );
      }
      throw failure(
        "CLI_SERVICE_UNAVAILABLE",
        "The observation connection ended.",
      );
    } catch (error) {
      if (options.signal?.aborted) return;
      const safe = errorView(error);
      if (
        attempt === 3 ||
        safe.code === "SERVICE_INSTANCE_CHANGED" ||
        safe.code === "INVALID_REQUEST"
      ) {
        yield { ok: false, error: safe, outcome: "not_applied", meta };
        return;
      }
    } finally {
      clearTimeout(timer);
      controller.abort();
      options.signal?.removeEventListener("abort", abort);
    }
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(retryTimer);
        options.signal?.removeEventListener("abort", done);
        resolve();
      };
      const retryTimer = setTimeout(done, 100 * 2 ** attempt);
      options.signal?.addEventListener("abort", done, { once: true });
      if (options.signal?.aborted) done();
    });
  }
}
