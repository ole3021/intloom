import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import * as z from "zod";
import { parseLoomInput } from "@intloom/loom-sdk";
import { packageVersion } from "../version.ts";
import {
  E2eError,
  type Options,
  type Results,
  type Run,
  type ResultStatus,
} from "./contracts.ts";
import {
  selectCase,
  copyCase,
  roundKnowledge,
  roundInput,
  digest,
} from "./cases.ts";
import {
  readConfiguration,
  resolveModels,
  modelSecrets,
} from "./configuration.ts";
import { Evidence, redact, type EvidenceEvent } from "./evidence.ts";
import { snapshotCandidate } from "./candidate.ts";
import { snapshotSuite, runScripts } from "./checks.ts";
import { CmdDriver } from "./drivers/cmd.ts";
import { McpDriver, type Driver } from "./drivers/mcp.ts";
import { availableLoom, prepareProject } from "./project.ts";
import { UserRound } from "./agents/user.ts";
import { captureConsole } from "./console.ts";

export async function execute(
  options: Options,
  externalSignal: AbortSignal,
  environment: NodeJS.ProcessEnv = process.env,
  observer?: (event: EvidenceEvent) => void,
  ownsConsole = false,
) {
  const packagePath = await realpath(options.packagePath);
  await mkdir(options.root, { recursive: true });
  const root = await realpath(options.root);
  const insideSuite = relative(join(packagePath, "e2e"), root);
  if (
    !insideSuite ||
    (!insideSuite.startsWith(`..${sep}`) &&
      insideSuite !== ".." &&
      !insideSuite.startsWith(sep))
  )
    throw new E2eError(
      "ROOT_INVALID",
      "Place execution output outside the Loom's e2e directory.",
      "environment",
      "blocked",
    );
  const id = randomUUID(),
    directory = join(
      root,
      `e2e-${options.entry}-${new Date().toISOString().replace(/[:.]/gu, "-")}-${id.slice(0, 8)}`,
    );
  await mkdir(directory, { mode: 0o700 });
  const project = join(directory, "project");
  const paths = {
    execution: directory,
    project,
    result: join(directory, "result.json"),
    report: join(directory, "report.md"),
    evidence: join(directory, "evidence"),
    mirrors: join(project, ".intloom/mirrors"),
  };
  const evidence = new Evidence(paths.evidence, observer);
  await evidence.prepare();
  const restoreConsole = ownsConsole ? captureConsole(evidence) : undefined;
  const controller = new AbortController();
  const signal = AbortSignal.any([externalSignal, controller.signal]);
  const env = {
    ...environment,
    npm_config_cache: join(directory, ".npm-cache"),
    TMPDIR: join(directory, "tmp"),
  };
  await mkdir(env.TMPDIR);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cmd: CmdDriver | undefined,
    driver: Driver | undefined,
    current: UserRound | undefined;
  let status: ResultStatus = "blocked";
  let error: { code: string; message: string; category: string } | null = null;
  let checksConfigured = false;
  let expectedRounds = 0;
  let cleanup = "not_needed";
  const rounds: {
    id: string;
    input: unknown;
    run: Run;
    results: Results;
    checks: { status: string };
  }[] = [];
  let metadata: Record<string, unknown> = {
    schemaVersion: 1,
    executionId: id,
    startedAt: new Date().toISOString(),
    entry: options.entry,
    packagePath,
    cli: { version: packageVersion, path: options.cli },
  };
  try {
    const selected = await selectCase(
      join(packagePath, "e2e/cases"),
      options.caseId,
      options.seed,
    );
    const config = await readConfiguration(join(packagePath, "e2e"));
    expectedRounds = selected.data.manifest.rounds.length;
    checksConfigured = config.checks.length > 0;
    // Limits include candidate preservation, installation, model sessions and checks.
    if (config.limits.maxDurationMs)
      timer = setTimeout(
        () =>
          controller.abort(
            new E2eError(
              "EXECUTION_TIMEOUT",
              "E2E exceeded its configured duration.",
              "runner",
            ),
          ),
        config.limits.maxDurationMs,
      );
    const models = await resolveModels(config, options.profile, env);
    evidence.secrets.push(...modelSecrets(models, env));
    const suite = join(directory, "suite");
    await snapshotSuite(join(packagePath, "e2e"), suite);
    await copyCase(selected.data, join(directory, "case"));
    const data = { ...selected.data, directory: join(directory, "case") };
    metadata = {
      ...metadata,
      case: data.manifest,
      caseDigest: data.digest,
      selection: {
        candidates: selected.candidates,
        seed: selected.seed,
        random: selected.random,
      },
      configuration: { ...config, models },
    };
    await evidence.event("execution_started", {
      entry: options.entry,
      caseId: data.manifest.id,
      directory,
    });
    const sourceManifest = JSON.parse(
      await readFile(join(packagePath, "package.json"), "utf8"),
    );
    const builtPath = join(packagePath, "dist");
    if (
      !(
        await lstat(join(builtPath, "package.json")).catch(() => undefined)
      )?.isFile()
    )
      throw new E2eError(
        "LOOM_NOT_BUILT",
        "Run intloom build for this local Loom before E2E.",
        "environment",
        "blocked",
      );
    const built = z
      .object({
        name: z.string(),
        version: z.string(),
        loom: z.object({ type: z.literal("loom"), version: z.string() }),
      })
      .parse(
        JSON.parse(await readFile(join(builtPath, "package.json"), "utf8")),
      );
    if (built.name !== sourceManifest.name)
      throw new E2eError(
        "LOOM_PACKAGE_MISMATCH",
        "The built distribution belongs to another package.",
        "scenario",
        "blocked",
      );
    const candidate = await snapshotCandidate(
      join(packagePath, "package.json"),
      builtPath,
      directory,
      evidence,
      signal,
      env,
    );
    metadata = {
      ...metadata,
      candidate,
      cli: {
        version: packageVersion,
        path: options.cli,
        entryDigest: digest(await readFile(options.cli)),
      },
    };
    cmd = new CmdDriver(
      options.cli,
      project,
      evidence,
      env,
      config.limits.commandTimeoutMs,
    );
    const scripts = (
      phase: "preparation" | "checks",
      context: unknown,
      contextName: string,
    ) =>
      runScripts({
        scripts: phase === "preparation" ? config.preparation : config.checks,
        phase,
        context,
        contextName,
        suite,
        project,
        evidence,
        timeout: config.limits.commandTimeoutMs,
        environment: env,
        signal,
      });
    await prepareProject(
      cmd,
      candidate.archive,
      data,
      config,
      models,
      options.entry,
      signal,
      async () => {
        await scripts(
          "preparation",
          {
            version: 1,
            project,
            execution: directory,
            caseDirectory: data.directory,
            entry: options.entry,
          },
          "preparation.json",
        );
      },
    );
    driver = options.entry === "mcp" ? new McpDriver(cmd) : cmd;
    const catalog =
      driver instanceof McpDriver
        ? ((await driver.call("list_looms", {}, signal)) as { looms: unknown })
            .looms
        : await cmd.call(["looms"], signal);
    const loom = availableLoom(catalog, built.name);
    for (const [index, round] of data.manifest.rounds.entries()) {
      signal.throwIfAborted();
      const input = parseLoomInput(
        loom.inputs,
        await roundInput(data.manifest, index, project),
      );
      current = new UserRound({
        driver,
        loomName: loom.loomName,
        input,
        index: index + 1,
        roundId: round.id,
        knowledge: roundKnowledge(data, index),
        previous: rounds.map((r) => ({
          id: r.id,
          input: r.input,
          runId: r.run.runId,
        })),
        config,
        models,
        evidence,
        environment: env,
        signal,
      });
      await evidence.event("iteration_started", {
        index: index + 1,
        total: data.manifest.rounds.length,
        roundId: round.id,
      });
      const run = await current.execute();
      const results: Results = { artifacts: [], records: [] };
      for (const ref of run.results ?? [])
        if (ref.kind === "record" || ref.kind === "artifact")
          results[ref.kind === "record" ? "records" : "artifacts"].push(
            await driver.result(ref.kind, ref.id, signal),
          );
      const previousRecords: unknown[] = [];
      for (const previous of rounds)
        for (const ref of previous.run.results ?? [])
          if (ref.kind === "record")
            previousRecords.push(await driver.result("record", ref.id, signal));
      const saved = {
        id: round.id,
        input,
        run,
        results,
        checks: { status: checksConfigured ? "failed" : "not_configured" },
      };
      const previousRounds = [...rounds];
      rounds.push(saved);
      saved.checks = await scripts(
        "checks",
        {
          version: 1,
          entry: options.entry,
          project,
          execution: directory,
          caseDirectory: data.directory,
          caseId: data.manifest.id,
          round: { id: round.id, index: index + 1, input },
          run,
          results,
          previousRounds,
          previousRecords,
          confirmations: current.confirmations,
          mirrors: paths.mirrors,
        },
        `round-${index + 1}.json`,
      );
      await evidence.event("iteration_finished", {
        index: index + 1,
        runId: run.runId,
        checks: saved.checks.status,
      });
    }
    status = "passed";
  } catch (cause) {
    const actual = externalSignal.aborted
      ? new E2eError(
          "EXECUTION_INTERRUPTED",
          "E2E interrupted.",
          "runner",
          "interrupted",
        )
      : signal.aborted && signal.reason instanceof E2eError
        ? signal.reason
        : cause instanceof E2eError
          ? cause
          : new E2eError(
              "E2E_FAILED",
              cause instanceof Error ? cause.message : String(cause),
              current ? "runner" : "environment",
              current ? "failed" : "blocked",
            );
    status = actual.status;
    error = {
      code: actual.code,
      message: actual.message,
      category: actual.category,
    };
    await evidence.event("failure", error);
  } finally {
    if (timer) clearTimeout(timer);
    let cleanupError: unknown;
    try {
      try {
        await driver?.close();
      } catch (cause) {
        cleanupError = cause;
      }
      if (
        cmd &&
        (await lstat(join(project, ".intloom/service.json")).catch(
          () => undefined,
        ))
      ) {
        // Query all original Runs, including admission with a lost response, before stopping our service.
        try {
          const runs = (await cmd.call(["runs"])) as Run[];
          for (const run of runs)
            if (!["completed", "failed"].includes(run.status))
              await cmd.call(["cancel", run.runId]);
        } catch (cause) {
          cleanupError ??= cause;
        } finally {
          await cmd.call(["stop"]);
        }
        cleanup = "stopped";
      }
    } catch (cause) {
      cleanupError ??= cause;
    }
    try {
      if (cleanupError) {
        cleanup = "failed";
        await evidence.event("cleanup_failed", {
          message: String(cleanupError),
        });
        if (status === "passed") {
          status = "failed";
          error = {
            code: "CLEANUP_FAILED",
            message: "The test service did not stop cleanly.",
            category: "system",
          };
        }
      }
    } finally {
      await restoreConsole?.();
    }
  }
  const checksStatus = !checksConfigured
    ? "not_configured"
    : rounds.some((r) => r.checks.status === "failed")
      ? "failed"
      : rounds.length === expectedRounds && expectedRounds > 0
        ? "passed"
        : rounds.length > 0
          ? "incomplete"
          : "not_run";
  const result = redact(
    {
      ...metadata,
      status,
      error,
      endedAt: new Date().toISOString(),
      rounds,
      lastRun: current?.run ?? null,
      cleanup,
      checks: { status: checksStatus },
      paths,
    },
    evidence.secrets,
  );
  await writeFile(paths.result, `${JSON.stringify(result, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(
    paths.report,
    String(
      redact(
        `# IntLoom E2E result\n\nStatus: ${status}\nEntry: ${options.entry}\nCompleted rounds: ${rounds.length}\nCase checks: ${checksStatus}\nCleanup: ${cleanup}\n${error ? `\nFailure: ${error.code}: ${error.message}\n` : ""}\n${rounds.map((r) => `- ${r.id}: ${r.run.runId}; checks ${r.checks.status}`).join("\n")}\n\nEvidence: ${paths.evidence}\nProject: ${project}\n\nRun completion and case checks are reported separately. No automatic repair, restore or replay occurred.\n`,
        evidence.secrets,
      ),
    ),
    { flag: "wx", mode: 0o600 },
  );
  await evidence.flush();
  return { status, error, paths, rounds: rounds.length };
}
