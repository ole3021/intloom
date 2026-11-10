import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";
import { Server, createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod";
import {
  IntloomError,
  workDirectory,
  type AgentDefinition,
  type ExecutionOrigin,
  type ToolDefinition,
} from "@intloom/loom-sdk";
import type { AgentHarnessHost } from "./contracts.ts";

const exec = promisify(execFile);
export async function checkOpenCode() {
  const { stdout } = await exec("opencode", ["--version"], {
    timeout: 10000,
  }).catch(() => {
    throw new Error(
      "OpenCode is unavailable. Install OpenCode 2.x in the service PATH or select the Mastra harness.",
    );
  });
  if (!/^(?:opencode v?)?2\./m.test(stdout.trim()))
    throw new Error(
      `Configure OpenCode 2.x; installed version: ${stdout.trim()}`,
    );
}

export async function runOpenCode(
  services: AgentHarnessHost,
  definition: AgentDefinition,
  input: unknown,
  origin: ExecutionOrigin,
  waiting?: () => boolean,
) {
  const binding = services.model;
  if (binding.provider === "minimax-cn" || binding.options?.api === "responses")
    throw new Error(
      "The OpenCode adapter requires an OpenAI-compatible chat endpoint.",
    );
  const ctx = services.context;
  const instructions =
    typeof definition.instructions === "string"
      ? definition.instructions
      : await ctx.resources.readText(definition.instructions);
  const prompt = await definition.prompt({ inputData: input, context: ctx });
  const base = join(workDirectory(ctx.run), ".opencode-sessions");
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(join(base, "session-"));
  const token = randomBytes(32).toString("hex");
  const tools = (definition.tools ?? []) as readonly ToolDefinition[];
  const invocationId = services.id();
  let toolResult: unknown;
  let hasToolResult = false;
  let toolCalls = 0;
  async function invoke(tool: ToolDefinition, args: unknown) {
    const input = tool.inputSchema.parse(args);
    toolCalls++;
    const output = await services.observation.model(invocationId, origin, () =>
      services.callTool(tool, input, { ...origin, componentId: tool.id }),
    );
    if (tool.id === definition.resultTool) {
      toolResult = output;
      hasToolResult = true;
    }
    return output;
  }
  const handler = createMcpHandler(
    () => {
      const server = new Server(
        { name: "loom", version: "0.4.0" },
        {
          capabilities: { tools: {} },
          supportedProtocolVersions: ["2026-07-28"],
        },
      );
      server.setRequestHandler("tools/list", async () => ({
        tools: tools.map((t) => ({
          name: t.id,
          description: t.description,
          inputSchema: z.toJSONSchema(t.inputSchema) as { type: "object" },
        })),
      }));
      server.setRequestHandler("tools/call", async ({ params }) => {
        const tool = tools.find((t) => t.id === params.name);
        if (!tool) throw new Error("Undeclared tool");
        if (hasToolResult)
          return {
            content: [{ type: "text", text: JSON.stringify(toolResult) }],
          };
        const out = await invoke(tool, params.arguments ?? {});
        return { content: [{ type: "text", text: JSON.stringify(out) }] };
      });
      return server;
    },
    { legacy: "reject" },
  );
  const handle = toNodeHandler(handler);
  const bridge = createServer((req, res) => {
    if (
      req.url !== `/mcp/${token}` ||
      (req.headers.origin &&
        req.headers.origin !== `http://${req.headers.host}`)
    ) {
      res.writeHead(403).end();
      return;
    }
    void handle(req as Parameters<typeof handle>[0], res);
  });
  await new Promise<void>((ready, reject) => {
    bridge.once("error", reject);
    bridge.listen(0, "127.0.0.1", ready);
  });
  const port = (bridge.address() as AddressInfo).port;
  const began = Date.now();
  let backend: ChildProcessWithoutNullStreams | undefined;
  let stopped: Promise<unknown> | undefined;
  let succeeded = false;
  let stepCount = 0;
  let readUsage:
    | (() => Promise<
        {
          id: string;
          type: string;
          tokens?: { input: number; output: number };
        }[]
      >)
    | undefined;
  try {
    const model = "intloom/selected";
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      TMPDIR: process.env.TMPDIR,
      LANG: process.env.LANG,
      XDG_CONFIG_HOME: join(dir, "config"),
      XDG_DATA_HOME: join(dir, "data"),
      XDG_CACHE_HOME: join(dir, "cache"),
      XDG_STATE_HOME: join(dir, "state"),
      INTLOOM_BACKEND_KEY: await services.credential(),
      OPENCODE_PASSWORD: randomBytes(32).toString("hex"),
    };
    const config = {
      model,
      agents: {
        loom: {
          description: "Execute a packaged Loom capability",
          mode: "primary",
          prompt: tools.length
            ? "Use declared native Loom MCP tools. Invoke using function calls. Never print a tool call as assistant text. Return the requested final response after observing the actual tool result."
            : "Answer the task directly. This Agent has no tools. Return only the requested JSON when a schema is supplied.",
        },
      },
      providers: {
        intloom: {
          package: "@opencode/ai/providers/openai-compatible",
          settings: {
            baseURL: binding.options?.baseUrl ?? "https://api.openai.com/v1",
            apiKey: "{env:INTLOOM_BACKEND_KEY}",
          },
          models: {
            selected: {
              modelID: binding.model,
              capabilities: { tools: true, input: ["text"], output: ["text"] },
              limit: { context: 65536, output: 8192 },
            },
          },
        },
      },
      mcp: {
        servers: {
          loom: {
            type: "remote",
            url: `http://127.0.0.1:${port}/mcp/${token}`,
            oauth: false,
            codemode: false,
            protocol: "2026-07-28",
          },
        },
      },
      permissions: [
        { action: "*", resource: "*", effect: "deny" },
        { action: "loom_*", resource: "*", effect: "allow" },
      ],
    };
    await writeFile(join(dir, "opencode.json"), JSON.stringify(config), {
      mode: 0o600,
    });
    const format =
      definition.outputMode === "structured" && !definition.resultTool
        ? "\nReturn only JSON matching this schema: " +
          JSON.stringify(z.toJSONSchema(definition.outputSchema))
        : "";
    await services.recordEvent({
      type: "model.invocation.started",
      executionId: invocationId,
      origin,
      details: {
        invocationId,
        slot: definition.model.slot,
        provider: binding.provider,
        model: binding.model,
      },
    });
    // Wait for process close, including on cancellation, before acknowledging a stopped Run.
    const child = spawn("opencode", ["serve", "--stdio", "--port", "0"], {
      cwd: dir,
      env,
      signal: services.signal,
    });
    backend = child;
    backend.stderr.resume();
    stopped = new Promise<void>((resolve) =>
      child.once("close", () => resolve()),
    );
    backend.on("error", () => {});
    const lines = createInterface({ input: backend.stdout });
    const ready = await Promise.race([
      once(lines, "line"),
      stopped.then(() => {
        throw new Error("OpenCode exited before startup");
      }),
    ]);
    const url = JSON.parse(String(ready[0])).url;
    const address = new URL(url);
    if (address.hostname !== "127.0.0.1")
      throw new Error("Unexpected OpenCode listener");
    const deadline = Date.now() + 20000;
    while (tools.length) {
      services.signal.throwIfAborted();
      const probe = exec(
        "opencode",
        [
          "api",
          "--server",
          url,
          "get",
          `/api/mcp?location[directory]=${encodeURIComponent(dir)}`,
        ],
        { cwd: dir, env, signal: services.signal, timeout: 5000 },
      );
      probe.child.stdin?.end();
      const status = JSON.parse((await probe).stdout);
      const item = status.data?.find(
        (entry: { name: string }) => entry.name === "loom",
      );
      if (item?.status?.status === "connected") break;
      if (item?.status?.status === "failed")
        throw new Error("OpenCode tool connection failed");
      if (Date.now() >= deadline)
        throw new Error(
          "OpenCode could not connect its Run tools: " +
            JSON.stringify(status).slice(0, 280),
        );
      await delay(75, undefined, { signal: services.signal });
    }
    // This private OpenCode server serves one session. Read its settled message
    // receipts once, including any continuation, through the public API.
    const usageApi = async (path: string) => {
      const call = exec("opencode", ["api", "--server", url, "get", path], {
        cwd: dir,
        env,
        signal: services.signal,
        timeout: 5000,
        maxBuffer: 16 * 1024 * 1024,
      });
      call.child.stdin?.end();
      return JSON.parse((await call).stdout);
    };
    readUsage = async () => {
      const sessions = await usageApi("/api/session");
      if (sessions.data.length !== 1) return [];
      const messages = await usageApi(
        "/api/session/" +
          encodeURIComponent(sessions.data[0].id) +
          "/message?limit=100",
      );
      return messages.data
        .filter((message: { type: string }) => message.type === "assistant")
        .reverse();
    };
    const runTurn = async (message: string, continuation = false) => {
      const turn = exec(
        "opencode",
        [
          "run",
          "--server",
          url,
          "--format",
          "json",
          "--model",
          model,
          "--agent",
          "loom",
          ...(continuation ? ["--continue"] : []),
          "--",
          message,
        ],
        { cwd: dir, env, signal: services.signal, maxBuffer: 16 * 1024 * 1024 },
      );
      turn.child.stdin?.end();
      const { stdout } = await turn;
      const events = stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      stepCount += events.filter((e) => e.type === "step_finish").length;
      const failed = events.find((e) => e.type === "error");
      if (failed)
        throw new Error(
          "OpenCode failed: " +
            String(
              failed.error?.data?.message ??
                failed.error?.message ??
                "no response",
            ),
        );
      return events;
    };
    const nativeTools = tools.map((tool) => ({
      name: `loom_${tool.id}`,
      input: z.toJSONSchema(tool.inputSchema),
    }));
    const toolInstructions = tools.length
      ? "\nNative function names and signatures: " +
        JSON.stringify(nativeTools) +
        "\nUse native function calls for actions. "
      : "\n";
    const resultName = definition.resultTool && `loom_${definition.resultTool}`;
    let events = await runTurn(
      instructions + toolInstructions + prompt + format,
    );
    // A model can finish with prose instead of issuing a native call. Request one
    // typed decision on the same session only if no tool has started. Dispatch is
    // limited to the declared result tool or a clarification, after schema validation.
    if (
      resultName &&
      !hasToolResult &&
      !waiting?.() &&
      toolCalls === 0 &&
      (definition.generation?.maxSteps ?? 5) > 1
    ) {
      const allowed = tools.filter(
        (t) => t.id === definition.resultTool || t.id === "askUser",
      );
      const decisions = allowed.map((t) => ({
        tool: t.id,
        inputSchema: z.toJSONSchema(t.inputSchema),
      }));
      events = await runTurn(
        'No action has executed. Return one JSON object {"tool":"name","input":{...}} choosing from these exact options and providing the full input. Intloom will validate it and run that tool. Return only JSON. Options: ' +
          JSON.stringify(decisions),
        true,
      );
      if (toolCalls === 0) {
        const message = events.filter((e) => e.type === "text").at(-1)
          ?.part?.text;
        const decision = z
          .strictObject({ tool: z.string(), input: z.unknown() })
          .parse(
            JSON.parse(
              String(message)
                .trim()
                .replace(/^`{3}(?:json)?\s*|\s*`{3}$/g, ""),
            ),
          );
        const target = allowed.find((t) => t.id === decision.tool);
        if (!target)
          throw new Error("OpenCode selected an undeclared result action.");
        await services.recordEvent({
          type: "log",
          origin,
          details: {
            level: "info",
            message: "OpenCode submitted a structured tool call",
            data: { tool: target.id },
          },
        });
        await invoke(target, decision.input);
      }
    }
    if (waiting?.()) {
      succeeded = true;
      return undefined;
    }
    if (definition.resultTool) {
      if (!hasToolResult)
        throw new Error("OpenCode did not call its result tool.");
      const output = definition.outputSchema.parse(toolResult);
      succeeded = true;
      return output;
    }
    function outputFrom(turn: typeof events) {
      const text = turn.filter((e) => e.type === "text").at(-1)?.part?.text;
      if (typeof text !== "string")
        throw new Error("OpenCode returned no final text");
      const answer = text.trim();
      return definition.outputSchema.parse(
        definition.outputMode === "structured"
          ? JSON.parse(answer.replace(/^`{3}(?:json)?\s*|\s*`{3}$/g, ""))
          : answer,
      );
    }
    let result: unknown;
    try {
      result = outputFrom(events);
    } catch (error) {
      if (
        definition.outputMode !== "structured" ||
        tools.length ||
        (definition.generation?.maxSteps ?? 5) <= 1
      )
        throw error;
      result = outputFrom(
        await runTurn(
          "The previous response did not match the output schema. Respond with a single JSON value, with no tool invocation, prose, or markup." +
            format,
          true,
        ),
      );
    }
    succeeded = true;
    return result;
  } catch (error) {
    if (services.signal.aborted)
      throw new IntloomError("EXECUTION_CANCELLED", "OpenCode stopped");
    // Node's execFile errors include the command and prompt. Only report the backend error category.
    if (error && typeof error === "object" && "cmd" in error)
      throw new Error(
        "OpenCode process failed (" +
          String("code" in error ? error.code : "unknown") +
          ")",
      );
    throw error;
  } finally {
    const receipts =
      !services.signal.aborted && readUsage
        ? await readUsage().catch(() => [])
        : [];
    backend?.stdin.end();
    backend?.kill();
    await stopped;
    bridge.closeAllConnections();
    await new Promise<void>((resolve) => bridge.close(() => resolve()));
    await handler.close();
    if (receipts.length) {
      stepCount = receipts.length;
      for (const [i, receipt] of receipts.entries()) {
        const tokens = receipt.tokens;
        await services.recordEvent({
          type: "model.step.finished",
          executionId: invocationId,
          origin,
          details: {
            invocationId,
            step: i + 1,
            ...(tokens &&
            Number.isSafeInteger(tokens.input) &&
            tokens.input >= 0
              ? { inputTokens: tokens.input }
              : {}),
            ...(tokens &&
            Number.isSafeInteger(tokens.output) &&
            tokens.output >= 0
              ? { outputTokens: tokens.output }
              : {}),
          },
        });
      }
    }
    await services.recordEvent({
      type: "model.invocation.finished",
      executionId: invocationId,
      origin,
      details: {
        invocationId,
        status: services.signal.aborted
          ? "cancelled"
          : succeeded
            ? "succeeded"
            : "failed",
        stepCount,
        durationMs: Date.now() - began,
      },
    });
  }
}
