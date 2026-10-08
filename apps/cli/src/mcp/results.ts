import type { CallToolResult } from "@modelcontextprotocol/server";
import { errorView } from "../errors.ts";

export function toolResult(data: Record<string, unknown>): CallToolResult {
  return {
    structuredContent: data,
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}
export function toolFailure(error: unknown): CallToolResult {
  return { ...toolResult({ error: errorView(error) }), isError: true };
}
