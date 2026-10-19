import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import type { LoomInput } from "@intloom/loom-sdk";
import { E2eError, runSchema } from "../contracts.ts";
import type { CmdDriver } from "./cmd.ts";

export class McpDriver {
  private client = new Client({ name: "intloom-e2e", version: "1" });
  private connected = false;
  readonly cmd: CmdDriver;
  constructor(cmd: CmdDriver) {
    this.cmd = cmd;
  }
  async connect(signal: AbortSignal) {
    signal.throwIfAborted();
    const env = Object.fromEntries(
      Object.entries(this.cmd.environment).filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined &&
          !["NODE_OPTIONS", "NODE_TEST_CONTEXT"].includes(entry[0]),
      ),
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [this.cmd.cli, "mcp", "serve", "--project", this.cmd.project],
      cwd: this.cmd.project,
      env,
      stderr: "pipe",
    });
    let diagnostic = "";
    transport.stderr?.on("data", (data) => {
      if (diagnostic.length < 65536) diagnostic += String(data);
    });
    try {
      await this.client.connect(transport, { timeout: this.cmd.timeout });
      this.connected = true;
      const tools = await this.client.listTools();
      for (const name of [
        "run",
        "get_run",
        "answer_ask",
        "claim_agent_call",
        "call_agent_tool",
        "complete_agent_call",
      ])
        if (!tools.tools.some((t) => t.name === name))
          throw new Error(`Missing MCP Tool ${name}`);
      await this.cmd.evidence.event("mcp_connected", { tools });
    } catch (cause) {
      await this.client.close().catch(() => {});
      await this.cmd.evidence.event("mcp_connection_failed", { diagnostic });
      throw cause;
    }
  }
  async call(
    name: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
    capture = true,
  ): Promise<unknown> {
    if (!this.connected) await this.connect(signal);
    if (
      ["run", "answer_ask", "interact", "cancel_run", "pause_run"].includes(
        name,
      )
    ) {
      const status = (await this.call("status", {}, signal, false)) as {
        service: { instanceId: string };
      };
      args = {
        operationId: randomUUID(),
        serviceInstanceId: status.service.instanceId,
        ...args,
      };
    }
    const result = await this.client
      .callTool(
        { name, arguments: args },
        { timeout: this.cmd.timeout, signal },
      )
      .catch(() => {
        throw new E2eError(
          "MCP_OUTCOME_UNKNOWN",
          `Unknown outcome for ${name}. Do not replay mutations.`,
          "system",
        );
      });
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    let data: unknown;
    try {
      data = result.structuredContent ?? JSON.parse(text);
    } catch {
      if (result.isError)
        data = { error: { code: "MCP_TOOL_ERROR", message: text } };
      else
        throw new E2eError(
          "MCP_RESPONSE_INVALID",
          "MCP returned invalid structured data.",
          "system",
        );
    }
    this.cmd.evidence.protect(data);
    if (capture || result.isError)
      await this.cmd.evidence.event("mcp", {
        name,
        args,
        data,
        isError: result.isError,
      });
    if (result.isError) {
      const error = (data as { error?: { code?: string; message?: string } })
        ?.error;
      throw new E2eError(
        error?.code ?? "MCP_TOOL_ERROR",
        error?.message ?? text,
        "system",
      );
    }
    return data;
  }
  async start(loomName: string, input: LoomInput, signal: AbortSignal) {
    return runSchema.parse(
      (
        (await this.call("run", { loomName, input }, signal)) as {
          run: unknown;
        }
      ).run,
    );
  }
  async get(runId: string, signal: AbortSignal) {
    return runSchema.parse(
      (
        (await this.call("get_run", { runId }, signal, false)) as {
          run: unknown;
        }
      ).run,
    );
  }
  async answer(
    runId: string,
    actionId: string,
    answer: unknown,
    signal: AbortSignal,
  ) {
    return runSchema.parse(
      (
        (await this.call(
          "answer_ask",
          { runId, actionId, answer },
          signal,
        )) as { run: unknown }
      ).run,
    );
  }
  async result(kind: "artifact" | "record", id: string, signal: AbortSignal) {
    return (
      (await this.call(`get_${kind}`, { [`${kind}Id`]: id }, signal)) as Record<
        string,
        unknown
      >
    )[kind];
  }
  async close() {
    await this.client.close();
  }
}
export type Driver = McpDriver | CmdDriver;
