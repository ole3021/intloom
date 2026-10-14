import { randomUUID } from "node:crypto";
import * as z from "zod";
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  readdir,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
  E2eError,
  type Check,
  type Options,
  type ResultStatus,
  type Run,
  type Findings,
  type ProjectProfile,
} from "./contracts.ts";
import { selectCase, copyCase, digest } from "./cases.ts";
import { Evidence, redact, type EvidenceEvent } from "./evidence.ts";
import { modelSecrets } from "./profile.ts";
import {
  readConfiguration,
  caseConfiguration,
  configurationProfile,
  snapshotConfiguration,
} from "./configuration.ts";
import { runAcceptance } from "./acceptance.ts";
import { runPreparation } from "./preparation.ts";
import { runAgent } from "./agent.ts";
import { Session } from "./session.ts";
import { repositoryRoot } from "./options.ts";
import { processResult } from "./commands.ts";
import { loadEnvironment } from "./environment.ts";
import { prepareWorkspaceWorkflow } from "./workspace.ts";
import { preferRunFailure } from "./failure.ts";
import {
  userDecisionSchema,
  userDecisionToolSchema,
} from "./final-response.ts";
import { captureConsole } from "./console.ts";
import {
  prepareCodex,
  runCodexSmoke,
  collectCodex,
  type CodexExecution,
} from "./codex.ts";

export async function execute(
  options: Options,
  externalSignal?: AbortSignal,
  suppliedEnvironment?: NodeJS.ProcessEnv,
  observer?: (event: EvidenceEvent) => void,
  ownsConsole = false,
) {
  const id = randomUUID();
  await mkdir(options.root, { recursive: true });
  const root = await realpath(options.root);
  let selected: Awaited<ReturnType<typeof selectCase>> | undefined;
  let selectionFailure: unknown;
  try {
    selected = await selectCase(
      options.casesRoot,
      options.caseId,
      options.seed,
    );
  } catch (cause) {
    selectionFailure = cause;
  }
  const label = selected?.data.manifest.id ?? options.caseId ?? "random";
  const directory = join(
    root,
    `e2e-${options.entry}-${/^[A-Za-z0-9_-]+$/u.test(label) ? label : "random"}-${new Date().toISOString().replace(/[:.]/gu, "-")}-${id.slice(0, 8)}`,
  );
  await mkdir(directory, { mode: 0o700 });
  const project = join(directory, "project");
  const evidence = new Evidence(join(directory, "evidence"), observer);
  await evidence.prepare();
  const restoreConsole = ownsConsole ? captureConsole(evidence) : undefined;
  const paths = {
    execution: directory,
    project,
    report: join(directory, "report.md"),
    result: join(directory, "result.json"),
    evidence: evidence.directory,
    mirrors: join(project, ".intloom/mirrors"),
  };
  const controller = new AbortController();
  const signal = externalSignal
    ? AbortSignal.any([controller.signal, externalSignal])
    : controller.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let session: Session | undefined;
  let codex: CodexExecution | undefined;
  let findings: Findings | undefined;
  let status: ResultStatus = "failed";
  let error: { code: string; message: string; category: string } | null = null;
  let secondaryError: {
    code: string;
    message: string;
    category: string;
  } | null = null;
  let failureContext: ReturnType<Session["diagnostics"]> | undefined;
  let cleanup = { status: "not_needed" };
  let acceptanceConfigured = false;
  const checks: Check[] = [];
  const rounds: {
    index: number;
    intent: string;
    run: Run;
    acceptance: { status: string };
  }[] = [];
  let metadata: Record<string, unknown> = {
    schemaVersion: 2,
    executionId: id,
    entry: options.entry,
    startedAt: new Date().toISOString(),
    suite: options.suite,
    case: selected?.data.manifest ?? null,
    selection: { requestedCase: options.caseId ?? null, seed: options.seed },
  };
  try {
    if (!selected) throw selectionFailure;
    await copyCase(selected.data, join(directory, "case"));
    const data = { ...selected.data, directory: join(directory, "case") };
    metadata = {
      ...metadata,
      caseDigest: data.digest,
      selection: {
        selectedCase: data.manifest.id,
        candidates: selected.candidates,
        seed: selected.seed,
        random: selected.random,
      },
    };
    await evidence.event("execution_started", {
      entry: options.entry,
      caseId: data.manifest.id,
      directory,
    });
    const environment = {
      ...(suppliedEnvironment ?? loadEnvironment()),
      npm_config_cache: join(directory, ".npm-cache"),
      TMPDIR: join(directory, "tmp"),
    };
    await mkdir(environment.TMPDIR, { recursive: true });
    if (options.entry === "codex")
      codex = await prepareCodex(options, directory, evidence, environment);
    const config = codex
      ? undefined
      : caseConfiguration(
          await readConfiguration(options.suite),
          data.manifest,
        );
    acceptanceConfigured = Boolean(config?.acceptance?.scripts.length);
    let profile: ProjectProfile;
    if (codex) profile = codex.profile;
    else {
      if (!config)
        throw new E2eError(
          "CONFIGURATION_MISSING",
          "A Workflow E2E configuration is required.",
          "scenario",
          "blocked",
        );
      profile = configurationProfile(config, options.entry, environment);
    }
    if (profile.user)
      evidence.secrets.push(
        ...modelSecrets({ ...profile, user: profile.user }, environment),
      );
    const suiteSnapshot = join(directory, "suite");
    const acceptanceInstructions = config
      ? await snapshotConfiguration(options.suite, suiteSnapshot, config)
      : "";
    if (config) {
      options = { ...options, flowName: config.workflow.flowName };
      if (!options.workflow)
        options = {
          ...options,
          workspacePackage: resolve(options.suite, config.workflow.source),
          workspaceWorkflow: true,
        };
    }
    if (codex) options = { ...options, workflow: codex.workflow };
    if (profile.limits.maxDurationMs !== undefined) {
      timer = setTimeout(
        () =>
          controller.abort(
            new E2eError(
              "EXECUTION_TIMEOUT",
              "The optional E2E execution time limit was exceeded. See the last observed Run; no execution was replayed.",
              "runner",
            ),
          ),
        profile.limits.maxDurationMs,
      );
      timer.unref();
    }
    let workspaceCandidate:
      | Awaited<ReturnType<typeof prepareWorkspaceWorkflow>>
      | undefined;
    if (
      !codex &&
      (options.workspaceWorkflow ||
        options.cli === join(repositoryRoot, "apps/cli/dist/bin.js"))
    ) {
      workspaceCandidate = await prepareWorkspaceWorkflow(
        options,
        directory,
        evidence,
        signal,
        environment,
      );
      options = {
        ...options,
        cli: workspaceCandidate.cli,
        workflow: workspaceCandidate.archive,
      };
      await evidence.event("workspace_candidate_ready", {
        packages: workspaceCandidate.packages.length,
      });
    }
    if (!(await lstat(options.cli)).isFile())
      throw new E2eError(
        "CANDIDATE_MISSING",
        "Prepare a candidate CLI entry before testing.",
        "environment",
        "blocked",
      );
    const version = await processResult(
      process.execPath,
      [options.cli, "--version"],
      directory,
      10000,
      signal,
      environment,
    );
    if (version.code)
      throw new E2eError(
        "CLI_UNAVAILABLE",
        "The candidate CLI could not report its version.",
        "environment",
        "blocked",
      );
    const localWorkflow = await lstat(options.workflow).catch(() => undefined);
    if (options.workflow.startsWith("/") && !localWorkflow?.isFile())
      throw new E2eError(
        "CANDIDATE_MISSING",
        "The explicit Workflow archive is missing.",
        "environment",
        "blocked",
      );
    metadata = {
      ...metadata,
      nodeVersion: process.version,
      cli: {
        path: options.cli,
        version: version.stdout.trim(),
        entryDigest: digest(await readFile(options.cli)),
      },
      workflow: {
        source: codex
          ? "codex_compatibility"
          : options.workspaceWorkflow
            ? "workspace"
            : localWorkflow
              ? "archive"
              : "registry",
        reference: options.workflow,
        ...(localWorkflow
          ? { digest: digest(await readFile(options.workflow)) }
          : {}),
      },
      configuration: config ?? profile,
      ...(codex
        ? {
            scope: "codex_client_compatibility",
            codex: {
              command: codex.command,
              version: codex.version,
              modelOverride: codex.model,
            },
          }
        : {}),
    };
    session = new Session(
      options,
      profile,
      data,
      project,
      evidence,
      signal,
      environment,
      config?.preparation?.scripts.length
        ? (session) => runPreparation(session, config, suiteSnapshot)
        : undefined,
    );
    if (codex) {
      findings = await runCodexSmoke(session, codex);
      checks.push(...findings.checks);
    } else {
      if (!config || !profile.user)
        throw new E2eError(
          "CONFIGURATION_MISSING",
          "A Workflow configuration and simulated user model are required.",
          "environment",
          "blocked",
        );
      const instructions = await readFile(
        join(repositoryRoot, "e2e/instructions/user.md"),
        "utf8",
      );
      const entryInstructions = await readFile(
        join(repositoryRoot, `e2e/instructions/${options.entry}.md`),
        "utf8",
      );
      for (const [index, intent] of data.manifest.intents.entries()) {
        session.beginRound(index);
        await evidence.event("iteration_started", {
          index: index + 1,
          total: data.manifest.intents.length,
          intent,
        });
        const output = await runAgent({
          id: `simulated-user-${index + 1}`,
          outputSchema: z.toJSONSchema(userDecisionToolSchema),
          taskCompletion: true,
          model: profile.user,
          instructions: `${instructions}\n\n${entryInstructions}\n\n${acceptanceInstructions}`,
          prompt: JSON.stringify(
            {
              projectDirectory: project,
              workflowArchive: options.workflow,
              flowName: options.flowName,
              entry: options.entry,
              ...(options.entry === "mcp"
                ? { mcpTools: session.mcpProtocol() }
                : {}),
              case: data.manifest,
              iteration: {
                index: index + 1,
                total: data.manifest.intents.length,
                initializeProject: index === 0,
              },
              intent,
              previousRuns: rounds.map((round) => ({
                index: round.index,
                runId: round.run.runId,
                results: round.run.results,
              })),
              knowledge: data.knowledge,
              knowledgeRefs: data.knowledgeIds,
            },
            null,
            2,
          ),
          tools: session.userTools(),
          maxSteps: session.limits.maxUserSteps,
          connectionTimeoutMs: session.limits.modelConnectionTimeoutMs,
          idleTimeoutMs: session.limits.modelIdleTimeoutMs,
          connectionRetries: session.limits.modelConnectionRetries,
          signal: session.signal,
          evidence,
          environment,
          onToolCalls: session.inspectAnswerCalls.bind(session),
        });
        const decision = userDecisionSchema.safeParse(output);
        if (!decision.success)
          throw new E2eError(
            "MODEL_OUTPUT_INVALID",
            "The simulated user final response does not match the required result schema.",
            "model",
          );
        await evidence.event("user_finished", decision.data);
        if (decision.data.status === "blocked")
          throw new E2eError(
            "USER_BLOCKED",
            decision.data.reason,
            decision.data.category,
            "blocked",
          );
        const run = await session.finishRound();
        const round = {
          index: index + 1,
          intent,
          run,
          acceptance: {
            status: config.acceptance?.scripts.length
              ? "failed"
              : "not_configured",
          },
        };
        rounds.push(round);
        round.acceptance = await runAcceptance(session, config, suiteSnapshot, {
          entry: options.entry,
          project,
          execution: directory,
          cli: options.cli,
          flowName: options.flowName,
          storage: profile.storage,
          round: round.index,
          intent,
          run,
          previousRuns: rounds.slice(0, -1).map((item) => item.run),
          confirmations: session.confirmations.filter(
            (item) => item.runId === run.runId,
          ),
          mirrors: paths.mirrors,
          output: join(evidence.directory, `acceptance-${round.index}.json`),
        });
        await evidence.event("iteration_finished", {
          index: round.index,
          total: data.manifest.intents.length,
          runId: run.runId,
          status: run.status,
          acceptance: round.acceptance.status,
        });
      }
      checks.push({
        id: "ordered_execution",
        status: "passed",
        message: `All ${rounds.length} Intent Runs completed in order in one new project.`,
      });
    }
    status = checks.every((check) => check.status === "passed")
      ? "passed"
      : "failed";
    if (status === "failed")
      error = {
        code: "FUNCTIONAL_CHECK_FAILED",
        message: "Client compatibility checks failed. See preserved evidence.",
        category: "client",
      };
  } catch (cause) {
    failureContext = session?.diagnostics();
    const original = externalSignal?.aborted
      ? new E2eError(
          "EXECUTION_INTERRUPTED",
          "The E2E execution was interrupted.",
          "runner",
          "interrupted",
        )
      : controller.signal.aborted
        ? (controller.signal.reason as E2eError)
        : (session?.executionFailure ??
          (cause instanceof E2eError
            ? cause
            : new E2eError(
                "EXECUTION_FAILED",
                cause instanceof Error
                  ? cause.message
                  : "Execution preparation failed.",
                session ? "runner" : "environment",
                session ? "failed" : "blocked",
              )));
    const failure = preferRunFailure(
      original,
      session?.executionFailure
        ? undefined
        : [...(session?.runs.values() ?? [])].find(
            (run) => run.status === "failed",
          ),
    );
    status = failure.primary.status;
    error = {
      code: failure.primary.code,
      message: failure.primary.message,
      category: failure.primary.category,
    };
    if (failure.secondary)
      secondaryError = {
        code: failure.secondary.code,
        message: failure.secondary.message,
        category: failure.secondary.category,
      };
    await evidence.event("failure", {
      ...error,
      diagnostic: cause instanceof Error ? cause.message : "Unknown failure",
      context: failureContext,
      secondaryError,
    });
    if (session && codex && !findings) {
      try {
        findings = await collectCodex(session, codex);
        checks.push(...findings.checks);
      } catch (cause) {
        await evidence.event("collection_failed", {
          diagnostic:
            cause instanceof Error
              ? cause.message
              : "Evidence collection failed",
        });
      }
    }
  } finally {
    try {
      if (timer) clearTimeout(timer);
      if (session) {
        try {
          cleanup = await session.cleanup();
        } catch (cause) {
          cleanup = { status: "failed" };
          if (status === "passed") {
            status = "failed";
            error = {
              code: "CLEANUP_FAILED",
              message:
                "The service did not stop cleanly. Inspect the preserved project.",
              category: "system",
            };
          }
          await evidence.event("cleanup_failed", {
            diagnostic:
              cause instanceof Error ? cause.message : "Cleanup failed",
          });
        }
      }
    } finally {
      await restoreConsole?.();
    }
  }
  let mirrorIds = findings?.mirrorIds ?? [];
  // Mirror evidence stays in the project's own directory; no per-image business verification in the runner.
  if (!codex) {
    const names = await readdir(paths.mirrors, {
      recursive: true,
      withFileTypes: true,
    }).catch(() => []);
    mirrorIds = names
      .filter(
        (item) =>
          item.isFile() &&
          item.name === "mirror.json" &&
          /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu.test(
            basename(item.parentPath),
          ),
      )
      .map((item) => basename(item.parentPath));
  }
  if (!checks.length)
    checks.push({
      id: "ordered_execution",
      status: "failed",
      message: "The complete Intent list was not executed successfully.",
    });
  const lastRun =
    rounds.at(-1)?.run ??
    [...(session?.runs.values() ?? [])].at(-1) ??
    findings?.run ??
    null;
  const result = {
    ...metadata,
    entry: options.entry,
    case: selected?.data.manifest ?? null,
    endedAt: new Date().toISOString(),
    status,
    error,
    secondaryError,
    checks,
    cleanup,
    preparation: { status: session?.preparationStatus ?? "not_run" },
    rounds,
    runId: lastRun?.runId ?? null,
    traceId: lastRun?.control?.traceId ?? null,
    mirrorIds,
    coverage: findings?.coverage ?? {},
    diagnostics: failureContext ?? session?.diagnostics() ?? null,
    paths,
    acceptance: codex
      ? { status: "client_compatibility" }
      : {
          status: rounds.some((round) => round.acceptance.status === "failed")
            ? "failed"
            : !acceptanceConfigured
              ? "not_configured"
              : rounds.length === selected?.data.manifest.intents.length &&
                  rounds.every((round) => round.acceptance.status === "passed")
                ? "passed"
                : rounds.some((round) => round.acceptance.status === "passed")
                  ? "partial"
                  : "not_run",
        },
    boundaries: {
      productQualityAssessed: false,
      nativeFormsAssessed: false,
      codexClientAssessed: codex?.started ?? false,
      tuiAssessed: false,
      repairAttempted: false,
      restoreAttempted: false,
    },
  };
  const safe = redact(result, evidence.secrets) as typeof result;
  await writeFile(paths.result, `${JSON.stringify(safe, null, 2)}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  const report = [
    "# IntLoom E2E result",
    "",
    `Status: ${status}`,
    `Entry: ${options.entry}`,
    `Case: ${selected?.data.manifest.id ?? "unselected"}`,
    `Iterations completed: ${rounds.length}/${selected?.data.manifest.intents.length ?? 0}`,
    `Workflow acceptance: ${result.acceptance.status}`,
    `Workflow preparation: ${result.preparation.status}`,
    ...(error
      ? ["", `Failure: ${error.code} (${error.category})`, error.message]
      : []),
    ...(secondaryError
      ? [
          `Additional E2E failure: ${secondaryError.code} (${secondaryError.category})`,
          secondaryError.message,
        ]
      : []),
    ...(failureContext?.firstRejection
      ? [`First rejection: ${failureContext.firstRejection.reason}`]
      : []),
    "",
    "## Runs",
    "",
    ...rounds.map(
      (round) =>
        `- Iteration ${round.index}: ${round.run.runId}; status ${round.run.status}; acceptance ${round.acceptance.status}`,
    ),
    "",
    "## Preserved execution",
    "",
    ...Object.entries(paths).map(([key, path]) => `- ${key}: ${path}`),
    "",
    `Service cleanup: ${cleanup.status}`,
    "",
    "Execution completion is separate from optional Workflow acceptance. No product quality assessment, repair, mirror restoration or automatic rerun is performed.",
    "",
  ].join("\n");
  await writeFile(paths.report, String(redact(report, evidence.secrets)), {
    mode: 0o600,
    flag: "wx",
  });
  await evidence.event("execution_finished", {
    status,
    checksPassed: checks.filter((check) => check.status === "passed").length,
    checksTotal: checks.length,
    mirrors: mirrorIds.length,
    cleanup: cleanup.status,
  });
  await evidence.flush();
  return safe;
}
