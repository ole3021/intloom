import { randomUUID } from "node:crypto";
import {
  ExecutionCancelledError,
  ExecutionRejectedError,
  TextEncodingError,
  loomInputSchema,
} from "@intloom/loom-sdk";
import { z } from "zod";
import { jsonText } from "../persistence/json.ts";

export const bindingSchema = z.strictObject({
  runId: z.uuid(),
  executionId: z.uuid(),
  module: z.string(),
  export: z.string(),
  scope: z.enum(["intloom", "workspace"]),
  workDir: z.string(),
  tempDir: z.string(),
  input: loomInputSchema,
});
export type ProcessBinding = z.infer<typeof bindingSchema>;
const operationSchema = z.enum([
  "ready",
  "done",
  "answer",
  "exec.create",
  "exec.complete",
  "exec.stop",
  "interaction.update",
  "fs.read",
  "fs.write",
  "fs.mkdir",
  "fs.stat",
  "fs.list",
  "fs.remove",
  "fs.mkdtemp",
  "store.get",
  "store.set",
  "store.delete",
  "store.list",
  "process.run",
]);
export type Operation = z.infer<typeof operationSchema>;
const errorSchema = z.strictObject({ name: z.string(), message: z.string() });
const messageSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("request"),
    id: z.uuid(),
    operation: operationSchema,
    data: z.unknown(),
  }),
  z.strictObject({
    type: z.literal("response"),
    id: z.uuid(),
    value: z.unknown().optional(),
    error: errorSchema.optional(),
  }),
  z.strictObject({ type: z.literal("cancel"), reason: z.string() }),
]);
export type Message = z.infer<typeof messageSchema>;
export type RequestHandler = (
  operation: Operation,
  data: unknown,
) => Promise<unknown>;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class Peer {
  readonly #pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >();
  #closed: Error | undefined;
  constructor(
    private readonly send: (message: Message) => Promise<void>,
    private readonly handle: RequestHandler,
    private readonly fail: (error: Error) => void,
    private readonly cancel: (reason: string) => void = () => {},
  ) {}

  request<T = unknown>(operation: Operation, data: unknown): Promise<T> {
    if (this.#closed) return Promise.reject(this.#closed);
    const id = randomUUID();
    const payload = JSON.parse(jsonText(data));
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      void this.send({ type: "request", id, operation, data: payload }).catch(
        (error: unknown) => {
          this.#pending.delete(id);
          reject(error);
        },
      );
    });
  }

  receive(raw: unknown): void {
    const parsed = messageSchema.safeParse(raw);
    if (!parsed.success) {
      this.fail(parsed.error);
      return;
    }
    const message = parsed.data;
    if (message.type === "cancel") {
      this.cancel(message.reason);
      return;
    }
    if (message.type === "response") {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) {
        const { name, message: text } = message.error;
        const error: Error =
          name === "ExecutionCancelledError"
            ? new ExecutionCancelledError(text)
            : name === "ExecutionRejectedError"
              ? new ExecutionRejectedError(text)
              : name === "TextEncodingError"
                ? new TextEncodingError(text)
                : new Error(text);
        error.name = name;
        pending.reject(error);
      } else pending.resolve(message.value);
      return;
    }
    void (async () => {
      let response: Message;
      try {
        const value = await this.handle(message.operation, message.data);
        response = {
          type: "response",
          id: message.id,
          ...(value === undefined
            ? {}
            : { value: JSON.parse(jsonText(value)) }),
        };
      } catch (error) {
        response = {
          type: "response",
          id: message.id,
          error: {
            name: error instanceof Error ? error.name : "Error",
            message: errorMessage(error),
          },
        };
      }
      await this.send(response);
    })().catch((error: unknown) =>
      this.fail(error instanceof Error ? error : new Error(String(error))),
    );
  }

  abort(reason: string): Promise<void> {
    return this.send({ type: "cancel", reason });
  }
  close(error = new Error("Execution process disconnected")): void {
    this.#closed = error;
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }
}
