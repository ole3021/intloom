import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, cp, readFile, realpath, writeFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parse } from "smol-toml";
import * as z from "zod";
import {
  E2eError,
  codexProfileSchema,
  runSchema,
  type Check,
  type Findings,
  type Options,
  type ProjectProfile,
} from "./contracts.ts";
import { repositoryRoot } from "./options.ts";
import { processResult } from "./commands.ts";
import { digest } from "./cases.ts";
import type { Evidence } from "./evidence.ts";
import type { Session } from "./session.ts";
import { imageSchema } from "./mirrors.ts";

export const compatibilityFlow = "codex-compatibility";
type Event = Record<string, unknown>;
export interface CodexExecution {
  command: string;
  version: string;
  entryDigest: string;
  model: string | null;
  profile: ProjectProfile;
  workflow: string;
  events: { phase: string; event: Event }[];
  decisions: {
    phase: string;
    runId: string;
    status: string;
    knowledgeRefs: string[];
    reason: string;
  }[];
  started: boolean;
  configuration?: string;
}
const decisionSchema = z.strictObject({
  status: z.enum(["ready", "finished", "blocked"]),
  runId: z.string(),
  knowledgeRefs: z.array(z.string()),
  reason: z.string(),
});
function object(value: unknown): Event | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Event)
    : undefined;
}
export function mcpData(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return mcpData(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  const result = object(value);
  if (!result || result.isError === true || result.is_error === true)
    return undefined;
  const structured = result.structuredContent ?? result.structured_content;
  if (structured !== undefined) return structured;
  if (Array.isArray(result.content)) {
    for (const content of result.content) {
      const part = object(content);
      if (part?.type === "text" && typeof part.text === "string") {
        try {
          return JSON.parse(part.text);
        } catch {
          /* Another text block may contain the JSON result. */
        }
      }
    }
  }
  return undefined;
}
export function codexCalls(events: CodexExecution["events"]) {
  return events.flatMap(({ phase, event }) => {
    const item = object(event.item);
    if (
      event.type !== "item.completed" ||
      item?.type !== "mcp_tool_call" ||
      item.server !== "intloom" ||
      item.status !== "completed" ||
      item.error
    )
      return [];
    let args = item.arguments;
    if (typeof args === "string") {
      try {
        args = JSON.parse(args);
      } catch {
        return [];
      }
    }
    const data = mcpData(item.result);
    if (!object(args) || data === undefined || typeof item.tool !== "string")
      return [];
    return [{ phase, tool: item.tool, args: object(args) as Event, data }];
  });
}
export async function prepareCodex(
  options: Options,
  directory: string,
  evidence: Evidence,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CodexExecution> {
  const requested = options.codex ?? "codex";
  let command: string | undefined;
  for (const path of isAbsolute(requested)
    ? [requested]
    : (environment.PATH ?? "")
        .split(delimiter)
        .map((part) => resolve(part, requested))) {
    if (
      await access(path, constants.X_OK).then(
        () => true,
        () => false,
      )
    ) {
      command = await realpath(path);
      break;
    }
  }
  if (!command)
    throw new E2eError(
      "CODEX_UNAVAILABLE",
      "Install Codex CLI or provide --codex with its executable path.",
      "environment",
      "blocked",
    );
  const version = await processResult(
    command,
    ["--version"],
    directory,
    10000,
    undefined,
    environment,
  );
  const help = await processResult(
    command,
    ["exec", "--help"],
    directory,
    10000,
    undefined,
    environment,
  );
  if (
    version.code ||
    help.code ||
    ["--json", "--ephemeral", "--ignore-user-config", "--output-schema"].some(
      (flag) => !help.stdout.includes(flag),
    )
  )
    throw new E2eError(
      "CODEX_UNSUPPORTED",
      "The selected Codex CLI lacks the required non-interactive JSON and configuration-isolation options.",
      "environment",
      "blocked",
    );
  for (const key of ["CODEX_API_KEY", "OPENAI_API_KEY"]) {
    const value = environment[key];
    if (value) evidence.secrets.push(value);
  }
  if (
    environment.CODEX_API_KEY?.startsWith("encrypted:") ||
    environment.CODEX_API_KEY === ""
  )
    throw new E2eError(
      "CODEX_AUTH_REQUIRED",
      "CODEX_API_KEY must be a nonempty decrypted value, or use an existing Codex login.",
      "environment",
      "blocked",
    );
  if (!environment.CODEX_API_KEY) {
    const auth = await processResult(
      command,
      ["login", "status"],
      directory,
      10000,
      undefined,
      environment,
    );
    if (auth.code)
      throw new E2eError(
        "CODEX_AUTH_REQUIRED",
        "Authenticate Codex CLI before running this test; the runner does not perform login.",
        "environment",
        "blocked",
      );
  }
  const settings = codexProfileSchema.parse(
    JSON.parse(await readFile(options.profile as string, "utf8")),
  );
  const profile: ProjectProfile = { ...settings, mcpExecutor: "mcp_client" };
  const packagePath = join(directory, "compatibility-workflow");
  await cp(join(repositoryRoot, "e2e/fixtures/codex"), packagePath, {
    recursive: true,
  });
  const manifest = JSON.parse(
    await readFile(join(packagePath, "package.json"), "utf8"),
  );
  const zod = findPackageJSON("zod", import.meta.url);
  if (!zod)
    throw new E2eError(
      "DEPENDENCY_MISSING",
      "Install repository dependencies before preparing the compatibility Workflow.",
      "environment",
      "blocked",
    );
  manifest.dependencies = { zod: `file:${dirname(zod)}` };
  await writeFile(
    join(packagePath, "package.json"),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600 },
  );
  const packed = await processResult(
    "npm",
    [
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      directory,
      "--cache",
      join(directory, ".npm-cache"),
    ],
    packagePath,
    30000,
    undefined,
    environment,
  );
  await evidence.event("compatibility_package", {
    code: packed.code,
    stdout: packed.stdout,
    stderr: packed.stderr,
  });
  if (packed.code)
    throw new E2eError(
      "WORKFLOW_PACK_FAILED",
      "The local client-compatibility Workflow could not be packed.",
      "environment",
      "blocked",
    );
  const filename = z
    .array(z.object({ filename: z.string() }))
    .parse(JSON.parse(packed.stdout))[0]?.filename;
  if (!filename)
    throw new E2eError(
      "WORKFLOW_PACK_FAILED",
      "npm did not return a compatibility archive.",
      "environment",
      "blocked",
    );
  return {
    command,
    version: version.stdout.trim(),
    entryDigest: digest(await readFile(command)),
    model: options.codexModel ?? null,
    profile,
    workflow: join(directory, filename),
    events: [],
    decisions: [],
    started: false,
  };
}
function unwrap(result: { code: number; data: unknown }): unknown {
  const parsed = z
    .object({ ok: z.literal(true), data: z.unknown() })
    .safeParse(result.data);
  if (result.code || !parsed.success)
    throw new E2eError(
      "CODEX_SETUP_OR_QUERY_FAILED",
      "A required real CLI setup or independent query failed. See execution evidence.",
      "system",
    );
  return parsed.data.data;
}
export function codexTools(phase: string) {
  return phase === "agent"
    ? [
        "list_workflows",
        "flow",
        "get_run",
        "claim_agent_call",
        "call_agent_tool",
        "read_agent_asset",
        "complete_agent_call",
        "fail_agent_call",
      ]
    : phase === "human"
      ? ["get_run", "answer_ask"]
      : ["get_run", "get_artifact", "get_record", "list_artifacts"];
}
export function codexArguments(
  session: Session,
  execution: CodexExecution,
  schema: string,
  phase: string,
) {
  const server = z
    .object({
      mcp_servers: z.object({ intloom: z.record(z.string(), z.unknown()) }),
    })
    .parse(parse(execution.configuration ?? "")).mcp_servers.intloom;
  const overrides = {
    ...server,
    required: true,
    enabled_tools: codexTools(phase),
    default_tools_approval_mode: "approve",
  };
  return [
    "exec",
    "--json",
    "--ephemeral",
    "--ignore-user-config",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--disable",
    "shell_tool",
    "--disable",
    "apps",
    "--disable",
    "plugins",
    "--cd",
    session.project,
    "-c",
    `projects.${JSON.stringify(session.project)}.trust_level="trusted"`,
    "-c",
    'approval_policy="never"',
    "-c",
    'web_search="disabled"',
    ...Object.entries(overrides).flatMap(([key, value]) => [
      "-c",
      `mcp_servers.intloom.${key}=${JSON.stringify(value)}`,
    ]),
    "--output-schema",
    schema,
    "--color",
    "never",
    ...(execution.model ? ["--model", execution.model] : []),
    "-",
  ];
}
async function runPhase(
  session: Session,
  execution: CodexExecution,
  phase: string,
  prompt: string,
) {
  const schema = join(session.evidence.directory, `codex-${phase}-schema.json`);
  await session.evidence.save(
    `codex-${phase}-schema.json`,
    z.toJSONSchema(decisionSchema),
  );
  await session.evidence.save(`codex-${phase}-prompt.json`, { prompt });
  if (!execution.configuration)
    throw new E2eError(
      "CODEX_CONFIG_INVALID",
      "Generated project MCP configuration is unavailable.",
      "runner",
    );
  await writeFile(
    join(session.project, ".codex/config.toml"),
    `${execution.configuration}\nrequired = true\nenabled_tools = ${JSON.stringify(codexTools(phase))}\ndefault_tools_approval_mode = "approve"\n`,
    { mode: 0o600 },
  );
  const args = codexArguments(session, execution, schema, phase);
  await session.evidence.event("codex_process", {
    phase,
    command: execution.command,
    args,
  });
  execution.started = true;
  const environment = { ...session.environment };
  delete environment.NODE_OPTIONS;
  delete environment.NODE_TEST_CONTEXT;
  let stderr = "",
    pending = "",
    total = 0;
  let queue = Promise.resolve();
  let streamError: unknown;
  const child = spawn(execution.command, args, {
    cwd: session.project,
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    const kill = (signal: NodeJS.Signals) => {
      try {
        if (process.platform !== "win32" && child.pid)
          process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        /* Process group may already be gone. */
      }
    };
    kill("SIGTERM");
    killTimer = setTimeout(() => kill("SIGKILL"), 1000);
  };
  const accept = (line: string) => {
    if (!line.trim()) return;
    queue = queue.then(async () => {
      try {
        const event = object(JSON.parse(line));
        if (!event) throw new Error("Non-object Codex event");
        session.evidence.protect(event);
        execution.events.push({ phase, event });
        const item = object(event.item);
        await session.evidence.event("codex_event", {
          phase,
          event:
            item?.type === "reasoning"
              ? { type: event.type, item: { id: item.id, type: item.type } }
              : event,
        });
      } catch (cause) {
        streamError = cause;
        stop();
      }
    });
  };
  child.stdout.on("data", (chunk) => {
    total += chunk.length;
    if (total > 16 * 1024 * 1024) {
      streamError = new Error("Codex event output exceeded the bound");
      stop();
      return;
    }
    pending += String(chunk);
    let end = pending.indexOf("\n");
    while (end >= 0) {
      accept(pending.slice(0, end));
      pending = pending.slice(end + 1);
      end = pending.indexOf("\n");
    }
  });
  child.stderr.on("data", (chunk) => {
    if (stderr.length < 1024 * 1024) stderr += String(chunk);
  });
  child.stdin.on("error", () => {});
  session.signal.addEventListener("abort", stop, { once: true });
  child.stdin.end(prompt);
  let code: number | null;
  try {
    code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
      if (session.signal.aborted) stop();
    });
    accept(pending);
    await queue;
  } finally {
    session.signal.removeEventListener("abort", stop);
    if (killTimer) clearTimeout(killTimer);
  }
  await session.evidence.event("codex_exit", { phase, code, stderr });
  session.signal.throwIfAborted();
  if (streamError)
    throw new E2eError(
      "CODEX_EVENT_INVALID",
      "The Codex JSON event stream was invalid or exceeded its bound.",
      "client",
    );
  if (code !== 0)
    throw new E2eError(
      "CODEX_PROCESS_FAILED",
      "The real Codex client exited unsuccessfully. See Codex process evidence.",
      "client",
    );
  const events = execution.events
    .filter((part) => part.phase === phase)
    .map((part) => part.event);
  if (
    !events.some((event) => event.type === "turn.completed") ||
    events.some((event) =>
      ["error", "turn.failed"].includes(String(event.type)),
    )
  )
    throw new E2eError(
      "CODEX_TURN_INCOMPLETE",
      "Codex did not complete its client turn.",
      "client",
    );
  const messages = events
    .map((event) => object(event.item))
    .filter(
      (item) => item?.type === "agent_message" && typeof item.text === "string",
    );
  let output: unknown;
  try {
    output = JSON.parse(String(messages.at(-1)?.text ?? "null"));
  } catch {
    throw new E2eError(
      "CODEX_OUTPUT_INVALID",
      "The Codex final response was not valid JSON.",
      "client",
    );
  }
  const decision = decisionSchema.safeParse(output);
  if (!decision.success)
    throw new E2eError(
      "CODEX_OUTPUT_INVALID",
      "The Codex final response did not match the required client result schema.",
      "client",
    );
  execution.decisions.push({ phase, ...decision.data });
  await session.evidence.event("codex_decision", { phase, ...decision.data });
  if (decision.data.status === "blocked")
    throw new E2eError(
      "CODEX_CLIENT_BLOCKED",
      "The Codex client could not continue. See its English decision and diagnostics.",
      "client",
      "blocked",
    );
  return decision.data;
}
export async function runCodexSmoke(
  session: Session,
  execution: CodexExecution,
) {
  unwrap(await session.cli(["init"], session.signal));
  await session.seed();
  unwrap(
    await session.cli(["workflow", "add", execution.workflow], session.signal),
  );
  await session.configure();
  unwrap(await session.cli(["mcp", "init", "--ide", "codex"], session.signal));
  const configText = await readFile(
    join(session.project, ".codex/config.toml"),
    "utf8",
  );
  const config = z
    .object({
      mcp_servers: z.object({
        intloom: z.object({
          command: z.string(),
          args: z.array(z.string()),
          cwd: z.string(),
          tool_timeout_sec: z.number(),
        }),
      }),
    })
    .parse(parse(configText));
  const server = config.mcp_servers.intloom;
  execution.configuration = configText;
  if (
    server.command !== process.execPath ||
    !isDeepStrictEqual(server.args, [
      session.options.cli,
      "mcp",
      "serve",
      "--project",
      session.project,
      "--ide",
      "codex",
    ]) ||
    server.cwd !== session.project
  )
    throw new E2eError(
      "CODEX_CONFIG_INVALID",
      "Generated Codex configuration does not target this execution's pinned CLI and project.",
      "system",
    );
  await session.evidence.save("codex-project-configuration.json", config);
  unwrap(await session.cli(["start"], session.signal));
  unwrap(
    await session.cli(["doctor", "--execution", "agent_ide"], session.signal),
  );
  const instructions = await readFile(
    join(repositoryRoot, "e2e/instructions/codex.md"),
    "utf8",
  );
  const agent = await runPhase(
    session,
    execution,
    "agent",
    `${instructions}\nRole: executor. Call list_workflows to discover ${compatibilityFlow}. Call flow exactly once with flowName ${compatibilityFlow} and this exact original intent: ${JSON.stringify(session.caseData.intent)}. Retain the actual runId. Follow get_run until pendingAgentCall exists; claim it with a stable unique claimId. Execute its instructions using only declared call_agent_tool operations and submit complete_agent_call with the required outcome. Stop when the Run is waiting for a human question. Never answer human actions. Finish with status ready, the original runId, empty knowledgeRefs, and reason as an empty string.`,
  );
  const calls = codexCalls(execution.events);
  if (
    calls.filter((call) => call.tool === "flow").length !== 1 ||
    !calls.some(
      (call) =>
        call.tool === "flow" &&
        object(call.data)?.run &&
        runSchema.parse(object(call.data)?.run).runId === agent.runId,
    )
  )
    throw new E2eError(
      "CODEX_ADMISSION_INVALID",
      "Codex did not retain exactly one actual flow admission.",
      "client",
    );
  await runPhase(
    session,
    execution,
    "human",
    `${instructions}\nRole: simulated human. Follow the existing Run ${agent.runId} using get_run. Answer its actual question by summarizing the authorized case knowledge below, using the exact current action and question IDs. Submit the complete array through answer_ask. Read and confirm the next confirmation if it agrees with the knowledge and original scope. Query until completed; do not claim Agent tasks. Return status finished, runId ${agent.runId}, nonempty relevant knowledgeRefs and an English decision explanation.\nCase: ${JSON.stringify(session.caseData.manifest)}\nOriginal intent: ${JSON.stringify(session.caseData.intent)}\nAuthorized knowledge:\n${session.caseData.knowledge}`,
  );
  await runPhase(
    session,
    execution,
    "query",
    `${instructions}\nRole: read-only verifier. Get the completed original Run ${agent.runId}. Read its actual committed Artifact and Record IDs from results and call get_artifact and get_record for those IDs. Require non-null saved values belonging to this Run. Return status finished, runId ${agent.runId}, empty knowledgeRefs and a short English result summary. Never mutate the Run or create another flow.`,
  );
  await session.evidence.event("verification_started", {
    scope: "codex compatibility",
  });
  return collectCodex(session, execution);
}
export async function collectCodex(
  session: Session,
  execution: CodexExecution,
): Promise<Findings> {
  const checks: Check[] = [];
  const check = (id: string, valid: boolean, message: string) =>
    checks.push({ id, status: valid ? "passed" : "failed", message });
  check(
    "project_setup",
    session.initialized &&
      session.seeded &&
      session.configured &&
      session.diagnosed,
    "A real initialized project generated the pinned Codex MCP connection configuration.",
  );
  if (!session.initialized)
    return {
      checks,
      run: null,
      mirrorIds: [],
      coverage: { scope: "codex_client_compatibility" },
    };
  unwrap(await session.cli(["runs"]));
  const runs = [...session.runs.values()];
  check(
    "single_run",
    runs.length === 1,
    "Only the original compatibility Run was admitted.",
  );
  if (!runs[0])
    return {
      checks,
      run: null,
      mirrorIds: [],
      coverage: { scope: "codex_client_compatibility" },
    };
  const run = await session.getRun(runs[0].runId);
  check(
    "run_completed",
    run.status === "completed" &&
      run.settled === true &&
      run.flowName === compatibilityFlow &&
      run.execution.source === "agent_ide" &&
      run.execution.agentExecutor === "mcp_client",
    "The original Run completed through a real external client Agent.",
  );
  const calls = codexCalls(execution.events);
  check(
    "codex_connection",
    calls.some(
      (call) =>
        call.phase === "agent" &&
        call.tool === "list_workflows" &&
        Array.isArray(object(call.data)?.workflows) &&
        ((object(call.data)?.workflows ?? []) as unknown[]).some(
          (flow) => object(flow)?.flowName === compatibilityFlow,
        ),
    ),
    "Codex discovered the installed Workflow through its actual MCP connection.",
  );
  check(
    "codex_agent_task",
    ["claim_agent_call", "complete_agent_call"].every(
      (tool) =>
        calls.filter(
          (call) =>
            call.phase === "agent" &&
            call.tool === tool &&
            call.args.runId === run.runId,
        ).length === 1,
    ) &&
      ["read_probe", "submit_probe"].every((toolId) =>
        calls.some(
          (call) =>
            call.phase === "agent" &&
            call.tool === "call_agent_tool" &&
            call.args.toolId === toolId &&
            call.args.runId === run.runId,
        ),
      ),
    "Codex claimed, executed host Tools and completed exactly one Agent task.",
  );
  const answers = calls.filter(
    (call) =>
      call.phase === "human" &&
      call.tool === "answer_ask" &&
      call.args.runId === run.runId,
  );
  const decision = execution.decisions.find((part) => part.phase === "human");
  check(
    "codex_human_actions",
    answers.some(
      (call) =>
        Array.isArray(call.args.answer) &&
        call.args.answer.some(
          (answer) =>
            object(answer)?.questionId === "scope" &&
            object(answer)?.isSkipped === false &&
            typeof object(answer)?.answer === "string",
        ),
    ) &&
      answers.some((call) => object(call.args.answer)?.isConfirmed === true) &&
      Boolean(
        decision?.knowledgeRefs.length &&
          decision.knowledgeRefs.every((id) =>
            session.caseData.knowledgeIds.includes(id),
          ),
      ),
    "A separate Codex human session answered the actual question and confirmed using case knowledge.",
  );
  const page = z.object({
    data: z.array(z.object({ id: z.string(), data: z.json() }).passthrough()),
  });
  const artifacts = z
    .object({ data: z.array(z.object({ id: z.string() }).passthrough()) })
    .parse(
      unwrap(await session.cli(["artifacts", "--flow", compatibilityFlow])),
    ).data;
  const records = page.parse(
    unwrap(await session.cli(["records", "--flow", compatibilityFlow])),
  ).data;
  const detailed = [];
  for (const artifact of artifacts)
    detailed.push(
      z
        .object({ id: z.string(), data: z.json() })
        .passthrough()
        .parse(unwrap(await session.cli(["artifact", artifact.id]))),
    );
  check(
    "codex_result_queries",
    detailed.length === 1 &&
      records.length === 1 &&
      detailed.every((artifact) =>
        calls.some(
          (call) =>
            call.phase === "query" &&
            call.tool === "get_artifact" &&
            isDeepStrictEqual(object(call.data)?.artifact, artifact),
        ),
      ) &&
      records.every((record) =>
        calls.some(
          (call) =>
            call.phase === "query" &&
            call.tool === "get_record" &&
            isDeepStrictEqual(object(call.data)?.record, record),
        ),
      ),
    "Codex queried non-null saved Artifact and Record details matching independent CLI evidence.",
  );
  check(
    "formal_results",
    detailed.length === 1 &&
      records.length === 1 &&
      [...detailed, ...records].every((entry) => {
        const data = object(entry.data);
        return (
          data?.id === run.runId &&
          data.intent === session.caseData.intent &&
          data.isConfirmed === true &&
          Number(data.readCount) > 0 &&
          object(data.task) &&
          Array.isArray(data.answers) &&
          data.answers.length === 1
        );
      }),
    "Saved business data preserves the original intent, host task and accepted human answers.",
  );
  const images = z
    .array(imageSchema)
    .parse(unwrap(await session.cli(["mirror", "list"])))
    .filter((image) => image.runId === run.runId);
  let integrity = images.length > 0;
  for (const image of images) {
    const inspected = z
      .object({
        integrity: z.object({ valid: z.boolean() }),
        "checkpoint.json": z.object({ run: z.object({ intent: z.string() }) }),
      })
      .parse(unwrap(await session.cli(["mirror", "inspect", image.mirrorId])));
    integrity &&=
      inspected.integrity.valid &&
      inspected["checkpoint.json"].run.intent === session.caseData.intent &&
      image.complete &&
      image.traceId === run.control?.traceId &&
      image.storageBackend === session.profile.storage;
  }
  const key = (image: z.infer<typeof imageSchema>) =>
    JSON.stringify([image.boundary.stageVisitId, image.boundary.stepVisitId]);
  const after = new Set(
    images.filter((image) => image.boundary.kind === "step_after").map(key),
  );
  check(
    "mirror_evidence",
    integrity &&
      !run.control?.captureDisabled &&
      ["agent", "questions", "confirmation", "finalize"].every((step) =>
        images.some(
          (image) =>
            image.boundary.kind === "step_before" &&
            image.boundary.stepName === step,
        ),
      ) &&
      images
        .filter((image) => image.boundary.kind === "step_before")
        .every((image) => after.has(key(image))) &&
      ["workflow_start", "stage_start", "stage_end", "workflow_end"].every(
        (kind) => images.some((image) => image.boundary.kind === kind),
      ),
    "Reached client-compatibility boundaries have complete, intact mirrors.",
  );
  check(
    "client_role_boundaries",
    !execution.events.some(({ event }) =>
      ["command_execution", "file_change"].includes(
        String(object(event.item)?.type),
      ),
    ) &&
      calls.every((call) =>
        call.phase === "agent"
          ? call.tool !== "answer_ask"
          : ![
              "flow",
              "claim_agent_call",
              "call_agent_tool",
              "complete_agent_call",
            ].includes(call.tool),
      ),
    "Client sessions used their assigned MCP roles without shell execution or direct file edits.",
  );
  await session.evidence.save("formal-results.json", {
    run,
    artifacts: detailed,
    records,
    images,
  });
  await session.cli(["logs", run.runId, "--debug"]);
  return {
    checks,
    run,
    mirrorIds: images.map((image) => image.mirrorId),
    coverage: {
      scope: "codex_client_compatibility",
      client: "codex_cli",
      agentTasks: 1,
      humanQuestions: 1,
      humanConfirmations: 1,
      desktopUiAssessed: false,
      nativeFormsAssessed: false,
      fullIntentAssessed: false,
      configurationLoadMode: "generated_config_overrides",
      projectConfigurationDiscoveryAssessed: false,
    },
  };
}
