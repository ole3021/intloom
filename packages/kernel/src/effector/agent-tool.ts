import * as z from "zod";
import type {
  AgentTool,
  AgentExecutionAccess,
  JsonValue,
} from "@intloom/loom-sdk";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { toolError } from "./errors.ts";
const inputErrors = new WeakSet<object>();

export function isAgentToolInputError(cause: unknown): boolean {
  const seen = new Set<unknown>();
  let current = cause;
  while (
    seen.size < 8 &&
    current &&
    typeof current === "object" &&
    !seen.has(current)
  ) {
    if (inputErrors.has(current)) return true;
    seen.add(current);
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

function inputPaths(tool: AgentTool, error: z.ZodError): string {
  const fields = new Set<string>();
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const item = value as Record<string, unknown>;
    if (item.properties && typeof item.properties === "object")
      for (const key of Object.keys(item.properties))
        if (/^[A-Za-z0-9_-]{1,64}$/u.test(key)) fields.add(key);
    Object.values(item).forEach(visit);
  }
  try {
    visit(agentJsonSchema(tool.inputSchema));
  } catch {
    /* Root diagnostics remain safe for opaque Schemas. */
  }
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path
        .slice(0, 8)
        .map((part) =>
          typeof part === "number" && Number.isSafeInteger(part) && part >= 0
            ? part
            : typeof part === "string" && fields.has(part)
              ? part
              : "item",
        );
      return `${path.length ? path.join(".") : "root"} (${issue.code})`;
    })
    .join(", ");
}

/** Transport schemas contain no Zod parser; original schemas run once inside the host. */
export function agentJsonSchema(
  schema: z.ZodType,
  io: "input" | "output" = "input",
) {
  const { "~standard": _standard, ...shape } = z.toJSONSchema(schema, {
    io,
    target: "draft-7",
    // An opaque output transform has no representable shape; never advertise its input as the returned value.
    ...(io === "output" ? { unrepresentable: "any" as const } : {}),
  });
  return z.json().parse(shape);
}

export async function executeAgentTool(
  tool: AgentTool,
  input: unknown,
  access: AgentExecutionAccess<JsonValue>,
): Promise<JsonValue> {
  access.signal.throwIfAborted();
  const parsed = await tool.inputSchema.safeParseAsync(input);
  access.signal.throwIfAborted();
  if (!parsed.success) {
    const error = KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: `Invalid input for Agent Tool ${tool.id}. Validation path: ${inputPaths(tool, parsed.error)}. Correct the input without replaying successful Tools.`,
    });
    inputErrors.add(error);
    throw error;
  }
  let failure: unknown;
  const record = (cause: unknown) => {
    failure ??= toolError(cause, tool.id);
  };
  const guarded = guardAgentAccess(access, record);
  try {
    const output = await tool.execute(parsed.data, guarded);
    access.signal.throwIfAborted();
    if (failure) throw failure;
    const result = await tool.outputSchema.safeParseAsync(output);
    access.signal.throwIfAborted();
    if (failure) throw failure;
    if (!result.success) throw result.error;
    return structuredClone(z.json().parse(result.data));
  } catch (cause) {
    access.signal.throwIfAborted();
    throw failure ?? toolError(cause, tool.id);
  }
}

export function agentToolEndsCall(tool: AgentTool, result: JsonValue): boolean {
  try {
    return tool.endsAgent?.(result) === true;
  } catch (cause) {
    throw toolError(cause, tool.id);
  }
}

/** A caught capability failure still invalidates the Tool result. */
export function guardAgentAccess(
  access: AgentExecutionAccess<JsonValue>,
  onFailure: (cause: unknown) => void,
): AgentExecutionAccess<JsonValue> {
  function read<T>(operation: () => T): T {
    try {
      access.signal.throwIfAborted();
      return operation();
    } catch (cause) {
      onFailure(cause);
      throw cause;
    }
  }
  async function invoke<T>(operation: () => Promise<T>): Promise<T> {
    try {
      access.signal.throwIfAborted();
      const result = await operation();
      access.signal.throwIfAborted();
      return result;
    } catch (cause) {
      onFailure(cause);
      throw cause;
    }
  }
  const project = access.project;
  return Object.freeze({
    signal: access.signal,
    ...(project
      ? {
          project: Object.freeze({
            snapshot: () => invoke(() => project.snapshot()),
            read: (path: string) => invoke(() => project.read(path)),
            write: (path: string, content: string) =>
              invoke(() => project.write(path, content)),
            remove: (path: string) => invoke(() => project.remove(path)),
            run: (command: import("@intloom/loom-sdk").ProjectCommand) =>
              invoke(() => project.run(command, access.signal)),
          }),
        }
      : {}),
    state: Object.freeze({
      get value() {
        return read(() => access.state.value);
      },
      create: (value: JsonValue) => invoke(() => access.state.create(value)),
      update: (value: JsonValue) => invoke(() => access.state.update(value)),
      clear: () => invoke(() => access.state.clear()),
    }),
    storage: Object.freeze({
      getArtifact: (loom, stage) =>
        invoke(() => access.storage.getArtifact(loom, stage)),
      getArtifactById: (id) => invoke(() => access.storage.getArtifactById(id)),
      getLatestRecord: (loom, stage) =>
        invoke(() => access.storage.getLatestRecord(loom, stage)),
      getRecordById: (id) => invoke(() => access.storage.getRecordById(id)),
      listArtifacts: (query) =>
        invoke(() => access.storage.listArtifacts(query)),
      listRecords: (query) => invoke(() => access.storage.listRecords(query)),
    } satisfies AgentExecutionAccess<JsonValue>["storage"]),
  });
}

export function assertToolActive(active: boolean): void {
  if (!active) throw RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST");
}
