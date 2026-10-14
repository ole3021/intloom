import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { execute } from "../runner/execute.ts";
import { repositoryRoot } from "../runner/options.ts";
import { modelFixture } from "./model-fixture.ts";
import { loadEnvironment } from "../runner/environment.ts";
import {
  prepareWorkspaceWorkflow,
  snapshotWorkflow,
} from "../runner/workspace.ts";
import { Evidence } from "../runner/evidence.ts";
import { stringify } from "yaml";
import { Progress } from "../runner/progress.ts";

test("CMD and MCP install the current workspace runtime graph offline and run the unmodified four-Stage Intent with complete mirrors", {
  timeout: 240000,
}, async (t) => {
  const base = await mkdtemp(join(tmpdir(), "e2e-runner-acceptance-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const cases = join(base, "cases"),
    casePath = join(cases, "S99");
  await mkdir(join(casePath, "workspace/src"), { recursive: true });
  await mkdir(join(casePath, "workspace/test"));
  await writeFile(
    join(casePath, "case.yaml"),
    'id: S99\nversion: 1\nname: Greeting transport fixture\nscale: small\ndescription: Controlled transport for the actual four-Stage package.\nintents:\n  - "  Implement a Unicode greeting\\nwithout dependencies.  "\n',
  );
  await writeFile(
    join(casePath, "knowledge.md"),
    "## K01 — Greeting\nGreeting format: Hello, name!\nUse ESM and built-in Node tests. You may confirm this scope and solution.\n",
  );
  await writeFile(
    join(casePath, "workspace/src/greet.mjs"),
    "export const greet = name => name;\n",
  );
  await writeFile(
    join(casePath, "workspace/test/greet.test.mjs"),
    'import assert from "node:assert/strict";\nimport {test} from "node:test";\nimport {greet} from "../src/greet.mjs";\ntest("greeting preserves Unicode", () => assert.equal(greet("friend"), "Hello, friend!"));\n',
  );
  const preparation = new Evidence(join(base, "preparation-evidence"));
  await preparation.prepare();
  const offline = {
    ...process.env,
    npm_config_offline: "true",
    npm_config_registry: "http://127.0.0.1:1",
  };
  const snapshot = await prepareWorkspaceWorkflow(
    {
      entry: "cmd",
      root: base,
      suite: join(repositoryRoot, "packages/intent/e2e"),
      casesRoot: cases,
      seed: "fixture",
      cli:
        process.env.INTLOOM_E2E_TEST_CLI ??
        join(repositoryRoot, "apps/cli/dist/bin.js"),
      workflow: "",
      workspaceWorkflow: true,
      workspacePackage: join(repositoryRoot, "packages/intent"),
    },
    base,
    preparation,
    new AbortController().signal,
    offline,
  );
  const cli = snapshot.cli;
  const archive = snapshot.archive;
  assert.ok(
    snapshot.packages.some(
      (entry) => entry.name === "@intloom/utils" && entry.workspace,
    ),
  );
  assert.ok(
    snapshot.packages.some(
      (entry) => entry.name === "@intloom/workflow-sdk" && entry.workspace,
    ),
  );
  assert.ok(
    snapshot.packages.some(
      (entry) => entry.name === "pino" && !entry.workspace,
    ),
  );
  t.diagnostic(
    `${snapshot.packages.length} preserved runtime packages; registry disabled`,
  );
  const envRoot = join(base, "intloom-checkout");
  await mkdir(envRoot);
  await writeFile(
    join(envRoot, ".env"),
    "ZEN_API_KEY=fixture-private-credential\n",
  );
  const environment = loadEnvironment(
    { ...offline, ZEN_API_KEY: undefined },
    envRoot,
  );
  for (const entry of ["cmd", "mcp"] as const)
    await t.test(entry, async (t) => {
      const fixture = await modelFixture(
        t,
        entry,
        false,
        entry === "cmd" ? "once" : "none",
        false,
        entry === "mcp",
      );
      const progressLines: string[] = [];
      const progress = new Progress((line) => progressLines.push(line));
      const model = {
        provider: "openai-compatible",
        model: "user",
        secret: "ENV.ZEN_API_KEY",
        baseURL: fixture.baseURL,
      };
      const suite = join(base, `suite-${entry}`);
      await mkdir(suite);
      if (entry === "cmd") {
        await cp(
          join(repositoryRoot, "packages/intent/e2e/checks"),
          join(suite, "checks"),
          { recursive: true },
        );
        await mkdir(join(suite, "node_modules"));
        const zodManifest = findPackageJSON("zod", import.meta.url);
        assert.ok(zodManifest);
        await symlink(dirname(zodManifest), join(suite, "node_modules/zod"));
      }
      const profile = join(suite, "config.yaml");
      await writeFile(
        profile,
        stringify({
          workflow: { source: "..", flowName: "intent" },
          zen: { baseURL: model.baseURL },
          models: {
            user: "user",
            mcp: { worker: "worker" },
            cmd: { default: "system" },
          },
          storage: entry === "cmd" ? "sqlite" : "file",
          ...(entry === "cmd"
            ? { acceptance: { scripts: ["checks/results.ts"] } }
            : {}),
          limits: { maxDurationMs: 120000, maxUserSteps: 120 },
        }),
      );
      const result = await execute(
        {
          entry,
          root: join(base, "runs"),
          casesRoot: cases,
          caseId: "s99",
          seed: "fixture",
          suite,
          cli,
          workflow: archive,
        },
        undefined,
        environment,
        progress.handle,
        true,
      );
      const evidence = await readFile(
        join(result.paths.evidence, "actions.jsonl"),
        "utf8",
      );
      assert.equal(
        result.status,
        "passed",
        JSON.stringify(
          {
            error: result.error,
            checks: result.checks,
            failures: fixture.failures,
            diagnostics: evidence
              .split("\n")
              .filter(Boolean)
              .map((line) => JSON.parse(line))
              .filter((event) =>
                ["failure", "collection_failed", "user_action_error"].includes(
                  event.kind,
                ),
              )
              .map((event) => event.data),
          },
          null,
          2,
        ),
      );
      assert.match(result.paths.execution, /e2e-(cmd|mcp)-S99-/u);
      const saved = JSON.parse(await readFile(result.paths.result, "utf8"));
      assert.equal(saved.workflow.source, "archive");
      assert.equal(result.cleanup.status, "stopped");
      assert.equal(
        result.diagnostics?.rejectedAnswers,
        entry === "cmd" ? 1 : 0,
      );
      assert.ok(
        progressLines.some((line) => line.includes("Iteration 1/1 completed")),
      );
      assert.ok(progressLines.some((line) => line.includes("Result passed")));
      assert.equal(
        progressLines.join("").includes("fixture-private-credential"),
        false,
      );
      assert.ok(result.mirrorIds.length > 20);
      t.diagnostic(
        `${entry}: ${result.mirrorIds.length} captured mirrors; ${result.checks.length} passed functional checks; cleanup ${result.cleanup.status}`,
      );
      assert.ok(evidence.includes('"human_answer"'));
      assert.equal(result.rounds.length, 1);
      assert.equal(
        result.acceptance.status,
        entry === "cmd" ? "passed" : "not_configured",
      );
      assert.equal(evidence.includes('mirror","inspect'), false);
      assert.equal(evidence.includes("formal-results.json"), false);
      assert.ok(evidence.includes('"knowledgeRefs":["K01"]'));
      assert.equal(evidence.includes("fixture-private-credential"), false);
      assert.ok(fixture.models.has("user"));
      assert.equal(fixture.models.has("worker"), entry === "mcp");
      assert.equal(fixture.models.has("system"), entry === "cmd");
      assert.equal(
        (await readdir(join(result.paths.project, ".intloom"))).includes(
          "service.json",
        ),
        false,
      );
      assert.equal(fixture.failures.length, 0);
      assert.ok(
        fixture.userRequests < 30,
        `Waiting should not repeatedly request the simulated-user model: ${fixture.userRequests} requests`,
      );
      assert.deepEqual(fixture.runningObservations, []);
      const events = evidence
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.deepEqual(
        events.find(
          (event) =>
            event.kind === "model_task_completed" &&
            event.data.actor === "simulated-user-1",
        )?.data.value,
        { status: "finished" },
      );
      t.diagnostic(
        `${entry}: ${fixture.userRequests} user model requests with local Run observation`,
      );
    });
  const probe = join(base, "probe");
  await cp(join(repositoryRoot, "e2e/fixtures/codex"), probe, {
    recursive: true,
  });
  await symlink(
    join(repositoryRoot, "e2e/node_modules"),
    join(probe, "node_modules"),
  );
  const probeManifest = JSON.parse(
    await readFile(join(probe, "package.json"), "utf8"),
  );
  probeManifest.dependencies = { zod: "*" };
  await writeFile(join(probe, "package.json"), JSON.stringify(probeManifest));
  await writeFile(
    join(probe, "workflow.mjs"),
    (await readFile(join(probe, "workflow.mjs"), "utf8"))
      .replaceAll("codex-compatibility", "iteration-probe")
      .replace(
        "await access.storage.commit([",
        'const previous = await access.storage.getArtifact("iteration-probe", "compatibility");\n    await access.storage.commit([',
      )
      .replace(
        /\{ type: "create_artifact".*payload \}/u,
        (operation) =>
          `previous ? {type: "replace_artifact", id: previous.id, expectedRevision: previous.revision, payload} : ${operation}`,
      ),
  );
  const probeEvidence = new Evidence(join(base, "probe-evidence"));
  await probeEvidence.prepare();
  const probeSnapshot = await snapshotWorkflow(
    join(probe, "package.json"),
    probe,
    join(base, "probe-preparation"),
    probeEvidence,
    undefined,
    offline,
  );
  for (const entry of ["cmd", "mcp"] as const)
    await t.test(
      `generic ${entry}: one preparation before three ordered Runs and optional acceptance`,
      async (t) => {
        const fixture = await modelFixture(t, entry);
        const suite = join(base, `generic-${entry}`);
        const casePath = join(suite, "cases/Alpha");
        await mkdir(casePath, { recursive: true });
        await writeFile(
          join(casePath, "case.yaml"),
          stringify({
            id: "Alpha",
            version: 1,
            name: "Generic Workflow",
            description: "Three iterative scopes",
            intents: [
              "Create local scope",
              "Extend local scope",
              "Document local scope",
            ],
          }),
        );
        await writeFile(
          join(casePath, "knowledge.md"),
          "## K01 — Authorized scope\nUse local files and preserve prior scopes.\n",
        );
        await writeFile(
          join(suite, "prepare.mjs"),
          `import {readFile,writeFile} from 'node:fs/promises';\nimport {join} from 'node:path';\nconst c=JSON.parse(await readFile(process.argv[2],'utf8'));\nawait writeFile(join(c.project,'prepared.json'),JSON.stringify({entry:c.entry}),{flag:'wx'});\nconsole.log('Generic preparation passed');\n`,
        );
        await writeFile(
          join(suite, "check.mjs"),
          `import assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {join} from 'node:path';\nconst c=JSON.parse(await readFile(process.argv[2],'utf8'));\nassert.equal(JSON.parse(await readFile(join(c.project,'prepared.json'),'utf8')).entry,c.entry);\nassert.equal(c.run.status,'completed');\nassert.equal(c.previousRuns.length,c.round-1);\nassert.equal(c.run.flowName,'iteration-probe');\nassert.equal(c.run.results.length,2);\nconsole.log('Generic acceptance passed');\n`,
        );
        await writeFile(
          join(suite, "config.yaml"),
          stringify({
            workflow: { source: "..", flowName: "iteration-probe" },
            zen: { baseURL: fixture.baseURL },
            models: {
              user: "user",
              cmd: { default: "system" },
              mcp: { worker: "worker" },
            },
            limits: { maxDurationMs: 90000, maxUserSteps: 80 },
            preparation: { scripts: ["prepare.mjs"] },
            acceptance: { scripts: ["check.mjs"] },
          }),
        );
        const result = await execute(
          {
            entry,
            root: join(base, "runs"),
            suite,
            casesRoot: join(suite, "cases"),
            caseId: "alpha",
            seed: "fixture",
            cli,
            workflow: probeSnapshot.archive,
          },
          undefined,
          environment,
        );
        assert.equal(result.status, "passed", JSON.stringify(result.error));
        assert.equal(result.rounds.length, 3);
        assert.equal(result.acceptance.status, "passed");
        assert.equal(result.preparation.status, "passed");
        assert.equal(
          new Set(result.rounds.map((round) => round.run.runId)).size,
          3,
        );
        assert.equal(fixture.models.has("worker"), entry === "mcp");
        assert.equal(fixture.models.has("system"), entry === "cmd");
        const events = (
          await readFile(join(result.paths.evidence, "actions.jsonl"), "utf8")
        )
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        assert.equal(
          events.filter((event) => event.kind === "preparation_finished")
            .length,
          1,
        );
        assert.ok(
          events.findIndex((event) => event.kind === "preparation_finished") <
            events.findIndex(
              (event) => event.kind === "cli" && event.data.args[0] === "start",
            ),
        );
        assert.equal(
          events.filter(
            (event) => event.kind === "cli" && event.data.args[0] === "init",
          ).length,
          1,
        );
        assert.equal(
          events.filter(
            (event) =>
              (event.kind === "cli" && event.data.args[0] === "flow") ||
              (event.kind === "mcp" && event.data.name === "flow"),
          ).length,
          3,
        );
        assert.equal(
          events.filter((event) => event.kind === "acceptance_finished").length,
          3,
        );
        assert.equal(result.cleanup.status, "stopped");
        assert.deepEqual(fixture.failures, []);
        t.diagnostic(
          `${entry}: 3 ordered Runs; one initialization; Workflow acceptance passed`,
        );
        if (entry === "mcp") {
          await writeFile(join(suite, "check.mjs"), "process.exit(1);\n");
          const secondFixture = await modelFixture(t, entry);
          const config = JSON.parse(
            JSON.stringify({
              workflow: { source: "..", flowName: "iteration-probe" },
              zen: { baseURL: secondFixture.baseURL },
              models: { user: "user", mcp: { worker: "worker" } },
              limits: { maxDurationMs: 90000 },
              acceptance: { scripts: ["check.mjs"] },
            }),
          );
          await writeFile(join(suite, "config.yaml"), stringify(config));
          const failed = await execute(
            {
              entry,
              root: join(base, "runs"),
              suite,
              casesRoot: join(suite, "cases"),
              caseId: "Alpha",
              seed: "fixture",
              cli,
              workflow: probeSnapshot.archive,
            },
            undefined,
            environment,
          );
          assert.equal(failed.error?.code, "ACCEPTANCE_FAILED");
          assert.equal(failed.rounds.length, 1);
          assert.equal(failed.acceptance.status, "failed");
        }
      },
    );
  await t.test(
    "repeated invalid human input fails promptly for the original action and preserves diagnostic evidence",
    async (t) => {
      const fixture = await modelFixture(t, "mcp", false, "always");
      const model = {
        provider: "openai-compatible",
        model: "user",
        secret: "ENV.ZEN_API_KEY",
        baseURL: fixture.baseURL,
      };
      const suite = join(base, "suite-invalid-answers");
      await mkdir(suite);
      const profile = join(suite, "config.yaml");
      await writeFile(
        profile,
        stringify({
          workflow: { source: "..", flowName: "intent" },
          zen: { baseURL: model.baseURL },
          models: {
            user: "user",
            mcp: { worker: "worker" },
            cmd: { default: "system" },
          },
          limits: { maxDurationMs: 60000, maxUserSteps: 40 },
        }),
      );
      const result = await execute(
        {
          entry: "mcp",
          root: join(base, "runs"),
          casesRoot: cases,
          caseId: "s99",
          seed: "fixture",
          suite,
          cli,
          workflow: archive,
        },
        undefined,
        environment,
      );
      assert.equal(result.status, "failed");
      assert.equal(result.error?.code, "USER_ACTION_PROTOCOL_ERROR");
      assert.equal(result.error?.category, "model");
      assert.equal(result.diagnostics?.rejectedAnswers, 2);
      assert.equal(
        result.diagnostics?.pendingAction?.kind,
        "user_ask_questions",
      );
      assert.equal(
        result.diagnostics?.firstRejection?.actionId,
        result.diagnostics?.pendingAction?.id,
      );
      assert.equal(
        result.diagnostics?.lastRejection?.actionId,
        result.diagnostics?.pendingAction?.id,
      );
      assert.equal(result.diagnostics?.firstRejection?.inputType, "string");
      assert.equal(result.diagnostics?.lastRejection?.attempt, 2);
      assert.equal(result.cleanup.status, "stopped");
      assert.ok(result.mirrorIds.length > 0);
      const events = (
        await readFile(join(result.paths.evidence, "actions.jsonl"), "utf8")
      )
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.equal(
        events.filter(
          (event) => event.kind === "mcp" && event.data.name === "flow",
        ).length,
        1,
      );
      assert.equal(
        events.filter(
          (event) => event.kind === "mcp" && event.data.name === "answer_ask",
        ).length,
        0,
      );
      assert.equal(
        events.filter((event) => event.kind === "answer_rejected").length,
        2,
      );
      assert.match(
        await readFile(result.paths.report, "utf8"),
        /First rejection:.*answers/u,
      );
      assert.equal(fixture.failures.length, 0);
      t.diagnostic(
        `invalid answers: ${result.error?.code}; 2 rejections; ${result.mirrorIds.length} preserved mirrors; cleanup ${result.cleanup.status}`,
      );
    },
  );
  await t.test(
    "a failed Run remains the primary error when simulated-user narration is invalid",
    async (t) => {
      const fixture = await modelFixture(t, "cmd", false, "none", true);
      const model = {
        provider: "openai-compatible",
        model: "user",
        secret: "ENV.ZEN_API_KEY",
        baseURL: fixture.baseURL,
      };
      const suite = join(base, "suite-failed-service");
      await mkdir(suite);
      const profile = join(suite, "config.yaml");
      await writeFile(
        profile,
        stringify({
          workflow: { source: "..", flowName: "intent" },
          zen: { baseURL: model.baseURL },
          models: {
            user: "user",
            mcp: { worker: "worker" },
            cmd: { default: "system" },
          },
          limits: { maxDurationMs: 60000, maxUserSteps: 40 },
        }),
      );
      const result = await execute(
        {
          entry: "cmd",
          root: join(base, "runs"),
          casesRoot: cases,
          caseId: "s99",
          seed: "fixture",
          suite,
          cli,
          workflow: archive,
        },
        undefined,
        environment,
      );
      assert.equal(result.status, "failed");
      assert.equal(result.error?.code, "LLM_REQUEST_FAILED");
      assert.match(result.error.message, /410/u);
      assert.equal(result.secondaryError?.code, "MODEL_OUTPUT_INVALID");
      assert.equal(result.cleanup.status, "stopped");
      assert.ok(result.mirrorIds.length > 0);
      const events = (
        await readFile(join(result.paths.evidence, "actions.jsonl"), "utf8")
      )
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.equal(
        events.filter(
          (event) => event.kind === "cli" && event.data.args?.[0] === "flow",
        ).length,
        1,
      );
      assert.match(
        await readFile(result.paths.report, "utf8"),
        /Additional E2E failure: MODEL_OUTPUT_INVALID/u,
      );
      assert.equal(fixture.failures.length, 0);
    },
  );
  await t.test(
    "fatal MCP business Tool rejection remains primary and stops further model requests",
    async (t) => {
      const fixture = await modelFixture(
        t,
        "mcp",
        false,
        "none",
        false,
        false,
        true,
      );
      const suite = join(base, "suite-fatal-tool");
      await mkdir(suite);
      await writeFile(
        join(suite, "config.yaml"),
        stringify({
          workflow: { source: "..", flowName: "intent" },
          zen: { baseURL: fixture.baseURL },
          models: { user: "user", mcp: { worker: "worker" } },
          limits: { maxDurationMs: 60000, maxUserSteps: 50 },
        }),
      );
      const result = await execute(
        {
          entry: "mcp",
          root: join(base, "runs"),
          casesRoot: cases,
          caseId: "s99",
          seed: "fixture",
          suite,
          cli,
          workflow: archive,
        },
        undefined,
        environment,
      );
      assert.equal(result.status, "failed");
      assert.equal(result.error?.code, "TOOL_EXECUTION_FAILED");
      assert.equal(result.error?.category, "system");
      assert.equal(result.cleanup.status, "stopped");
      const events = (
        await readFile(join(result.paths.evidence, "actions.jsonl"), "utf8")
      )
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const submissions = events.filter(
        (event) =>
          event.kind === "mcp" &&
          event.data.args.toolId === "submit_validation",
      );
      assert.equal(submissions.length, 2);
      assert.equal(submissions[0].data.data.output.saved, false);
      assert.equal(submissions[1].data.result.isError, true);
      const last = submissions[1].sequence;
      assert.equal(
        events.filter(
          (event) =>
            event.sequence > last && event.kind === "model_connection_started",
        ).length,
        0,
      );
      assert.equal(fixture.failures.length, 0);
    },
  );
  for (const invalidCompletion of [false, true])
    await t.test(
      invalidCompletion
        ? "invalid MCP completion stops without another output request"
        : "truncated MCP Agent output fails and preserves evidence",
      async (t) => {
        const fixture = await modelFixture(
          t,
          "mcp",
          !invalidCompletion,
          "none",
          false,
          false,
          false,
          invalidCompletion,
        );
        const model = {
          provider: "openai-compatible",
          model: "user",
          secret: "ENV.ZEN_API_KEY",
          baseURL: fixture.baseURL,
        };
        const suite = join(
          base,
          invalidCompletion ? "suite-invalid-completion" : "suite-truncated",
        );
        await mkdir(suite);
        const profile = join(suite, "config.yaml");
        await writeFile(
          profile,
          stringify({
            workflow: { source: "..", flowName: "intent" },
            zen: { baseURL: model.baseURL },
            models: {
              user: "user",
              mcp: { worker: "worker" },
              cmd: { default: "system" },
            },
            limits: { maxDurationMs: 60000, maxUserSteps: 40 },
          }),
        );
        const result = await execute(
          {
            entry: "mcp",
            root: join(base, "runs"),
            casesRoot: cases,
            caseId: "s99",
            seed: "fixture",
            suite,
            cli,
            workflow: archive,
          },
          undefined,
          environment,
        );
        assert.equal(result.status, "failed");
        assert.equal(result.error?.category, "model");
        assert.equal(
          result.error?.code,
          invalidCompletion
            ? "MODEL_OUTPUT_INVALID"
            : "MODEL_EXECUTION_INCOMPLETE",
        );
        assert.equal(result.cleanup.status, "stopped");
        assert.ok(result.mirrorIds.length > 0);
        t.diagnostic(
          `truncated MCP Agent: ${result.error.code}; ${result.mirrorIds.length} preserved mirrors; cleanup ${result.cleanup.status}`,
        );
        const saved = JSON.parse(await readFile(result.paths.result, "utf8"));
        assert.equal(saved.status, "failed");
        const evidence = await readFile(
          join(result.paths.evidence, "actions.jsonl"),
          "utf8",
        );
        const events = evidence
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        if (invalidCompletion) {
          const rejected = events.find(
            (event) =>
              event.kind === "model_completion_rejected" &&
              event.data.calls.some((call: { toolName: string }) =>
                call.toolName.startsWith("e2e_complete_task"),
              ),
          );
          assert.ok(rejected);
          // An SDK transport invocation can be observed before abort settles; the fixture proves no second upstream completion request.
          assert.equal(fixture.completionAttempts, 1);
        }
        assert.equal(
          events.filter(
            (event) => event.kind === "mcp" && event.data.name === "flow",
          ).length,
          1,
        );
        assert.ok(
          events.some(
            (event) =>
              event.kind === "mcp" && event.data.name === "fail_agent_call",
          ),
        );
        assert.equal(evidence.includes("fixture-private-credential"), false);
        assert.equal(fixture.failures.length, 0);
      },
    );
});
