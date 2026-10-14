import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Evidence } from "../runner/evidence.ts";
import { parseOptions, repositoryRoot } from "../runner/options.ts";
import { prepareWorkspaceWorkflow } from "../runner/workspace.ts";
import { processResult } from "../runner/commands.ts";

test("current-source preparation builds CLI, Kernel and Workflow only inside the E2E directory", {
  timeout: 180000,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "e2e-source-acceptance-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const evidence = new Evidence(join(root, "evidence"));
  await evidence.prepare();
  const options = await parseOptions(["cmd", "--root", root, "--case", "s01"]);
  assert.ok(options);
  options.workspacePackage = join(repositoryRoot, "packages/intent");
  const canonicalRoot = await realpath(root);
  const original = join(repositoryRoot, "apps/cli/dist/bin.js");
  const before = await stat(original);
  const environment = {
    ...process.env,
    npm_config_offline: "true",
    npm_config_registry: "http://127.0.0.1:1",
    TMPDIR: join(root, "tmp"),
  };
  await mkdir(environment.TMPDIR);
  const candidate = await prepareWorkspaceWorkflow(
    options,
    root,
    evidence,
    new AbortController().signal,
    environment,
  );
  assert.ok(candidate.cli.startsWith(root));
  assert.ok(candidate.archive.startsWith(root));
  assert.equal((await stat(original)).mtimeMs, before.mtimeMs);
  assert.ok(
    candidate.packages
      .filter((p) => p.workspace)
      .every((p) => p.source.startsWith(canonicalRoot)),
  );
  const version = await processResult(
    process.execPath,
    [candidate.cli, "--version"],
    root,
    10000,
    undefined,
    environment,
  );
  assert.equal(version.code, 0, version.stderr);
  const events = await readFile(
    join(evidence.directory, "actions.jsonl"),
    "utf8",
  );
  assert.ok(events.includes("workspace_build"));
  assert.ok(events.includes("workspace_package"));
  t.diagnostic(
    `isolated candidate: ${candidate.packages.length} runtime packages; CLI ${version.stdout.trim()}`,
  );
});
