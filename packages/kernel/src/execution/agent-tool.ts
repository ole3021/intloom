import { createToolAccess, guardAgentAccess } from "../access/code.ts";
import * as z from "zod";
import type {
  AgentTool,
  AgentExecutionAccess,
  JsonValue,
} from "@intloom/loom-sdk";
import { ERRORS } from "../errors.ts";
import { toolError, toolErrorDiagnostics } from "./errors.ts";
import { getLogger } from "@intloom/utils";
import { toolInputDigest } from "./tool-input-digest.ts";
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
  const child = createToolAccess(access);
  access = child.access;
  const log = getLogger();
  const diagnostics = log.isLevelEnabled("debug");
  const inputDigest = diagnostics ? toolInputDigest(input) : undefined;
  try {
    access.signal.throwIfAborted();
    const parsed = await tool.inputSchema.safeParseAsync(input);
    access.signal.throwIfAborted();
    if (!parsed.success) {
      const error = ERRORS.create("INVALID_REQUEST", {
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
      child.assertSettled();
      const result = await tool.outputSchema.safeParseAsync(output);
      access.signal.throwIfAborted();
      if (failure) throw failure;
      if (!result.success) throw result.error;
      child.assertSettled();
      return structuredClone(z.json().parse(result.data));
    } catch (cause) {
      access.signal.throwIfAborted();
      throw failure ?? toolError(cause, tool.id);
    }
  } catch (cause) {
    try {
      if (diagnostics)
        log.debug("agent_tool_failed", {
          toolName: tool.id,
          inputDigest,
          ...toolErrorDiagnostics(cause),
        });
    } catch {
      // Retain the Tool failure; logger health is checked by execution owners.
    }
    throw cause;
  } finally {
    child.close();
  }
}

export function agentToolEndsCall(tool: AgentTool, result: JsonValue): boolean {
  try {
    return tool.endsAgent?.(result) === true;
  } catch (cause) {
    throw toolError(cause, tool.id);
  }
}

export function assertToolActive(active: boolean): void {
  if (!active) throw ERRORS.create("EXECUTION_OWNERSHIP_LOST");
}
