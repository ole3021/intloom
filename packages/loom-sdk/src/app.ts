import { App } from "@modelcontextprotocol/ext-apps";
import type { Transport } from "@modelcontextprotocol/client";
import * as z from "zod";
import {
  appBootstrapSchema,
  appSnapshotSchema,
  appAnswerResultSchema,
  appOperationResultSchema,
  appMetaKey,
  type AppBootstrap,
  type AppSnapshot,
  type AppAnswer,
} from "./app-contracts.ts";
import type { JsonValue } from "./json.ts";
export * from "./app-contracts.ts";

/** Optional browser entry. Core Loom execution never imports this module. */
export async function connectLoomApp(options: {
  name: string;
  version?: string;
  transport?: Transport;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onError?: (error: Error) => void;
}) {
  const app = new App(
    { name: options.name, version: options.version ?? "1" },
    {},
    { strict: true },
  );
  let bootstrap: AppBootstrap;
  let snapshot: AppSnapshot;
  let pending: Omit<AppAnswer, "viewToken"> | undefined;
  let disposed = false;
  let polling: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(snapshot: AppSnapshot) => void>();
  const ready = Promise.withResolvers<AppBootstrap>();
  const timeoutMs = options.timeoutMs ?? 15000;
  const timeout = setTimeout(
    () => ready.reject(new Error("App initialization timed out")),
    timeoutMs,
  );
  const unpack = (result: {
    isError?: boolean | undefined;
    _meta?: Record<string, unknown> | undefined;
  }) => {
    if (result.isError)
      throw new Error(
        "App request failed; refresh the view or use standard interaction",
      );
    return result._meta?.[appMetaKey];
  };
  app.ontoolresult = (result) => {
    try {
      const parsed = appBootstrapSchema.safeParse(unpack(result));
      if (parsed.success) ready.resolve(parsed.data);
      else ready.reject(new Error("Unsupported Loom App protocol"));
    } catch (error) {
      ready.reject(error);
    }
  };
  function publish(next: AppSnapshot) {
    if (next.run.serviceInstanceId !== snapshot.run.serviceInstanceId)
      throw new Error("Service instance changed; reopen this Run");
    if (
      next.run.runId !== snapshot.run.runId ||
      next.run.loomIdentity !== snapshot.run.loomIdentity ||
      next.appId !== snapshot.appId
    )
      throw new Error("App view binding changed");
    if (next.run.revision < snapshot.run.revision) return;
    snapshot = next;
    for (const listener of listeners) listener(structuredClone(snapshot));
  }
  const request = async (name: string, args: Record<string, unknown>) =>
    unpack(
      await app.callServerTool(
        { name, arguments: { ...args, viewToken: bootstrap.viewToken } },
        { timeout: timeoutMs },
      ),
    );
  async function refresh() {
    if (disposed) throw new Error("App is closed");
    const next = appSnapshotSchema.parse(
      await request(bootstrap.methods.read, {}),
    );
    publish(next);
    return structuredClone(snapshot);
  }
  async function poll() {
    if (disposed) return;
    try {
      await refresh();
      if (
        snapshot.run.settled &&
        ["completed", "failed"].includes(snapshot.run.status)
      )
        return;
      polling = setTimeout(
        () => {
          void poll();
        },
        Math.max(250, options.pollIntervalMs ?? 1000),
      );
    } catch (cause) {
      options.onError?.(
        cause instanceof Error ? cause : new Error("App connection failed"),
      );
    }
  }
  const stop = () => {
    disposed = true;
    clearTimeout(polling);
    listeners.clear();
  };
  app.onteardown = async () => {
    stop();
    return {};
  };
  try {
    // Install the result handler before handshaking; a host can deliver immediately.
    await Promise.all([
      app.connect(options.transport, { timeout: timeoutMs }),
      ready.promise.then((value) => {
        bootstrap = value;
        snapshot = value.snapshot;
      }),
    ]);
  } catch (error) {
    stop();
    await app.close();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  polling = setTimeout(
    () => {
      void poll();
    },
    Math.max(250, options.pollIntervalMs ?? 1000),
  );
  return {
    snapshot: () => structuredClone(snapshot),
    subscribe(listener: (value: AppSnapshot) => void) {
      listeners.add(listener);
      listener(structuredClone(snapshot));
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    pendingSubmission: () => (pending ? structuredClone(pending) : undefined),
    async answer(actionId: string, answer: JsonValue) {
      if (disposed || pending)
        throw new Error("Resolve the previous submission before answering");
      if (
        snapshot.view.mode !== "interaction" ||
        snapshot.view.action.actionId !== actionId
      )
        throw new Error("This action is no longer displayed");
      pending = {
        serviceInstanceId: snapshot.run.serviceInstanceId,
        operationId: crypto.randomUUID(),
        actionId,
        answer: z.json().parse(answer),
      };
      const result = appAnswerResultSchema.parse(
        await request(bootstrap.methods.answer, pending),
      );
      if (["accepted", "rejected"].includes(result.receipt.status))
        pending = undefined;
      if (result.snapshot) publish(result.snapshot);
      return result;
    },
    async inspectSubmission() {
      if (!pending) return undefined;
      const result = appOperationResultSchema.parse(
        await request(bootstrap.methods.operation, {
          serviceInstanceId: pending.serviceInstanceId,
          operationId: pending.operationId,
        }),
      );
      if (
        result.status === "found" &&
        ["accepted", "rejected"].includes(result.receipt.status)
      )
        pending = undefined;
      await refresh();
      return result;
    },
    async dispose() {
      stop();
      await app.close();
    },
  };
}
export type LoomAppClient = Awaited<ReturnType<typeof connectLoomApp>>;
