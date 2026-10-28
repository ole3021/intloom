import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import * as api from "./index.ts";
import { packageVersion } from "./version.ts";

test("the public runtime exports and Core operations retain their names", () => {
  assert.deepEqual(Object.keys(api).sort(), [
    "actionForm",
    "addLoom",
    "codexConfiguration",
    "connectProject",
    "connectProjectClient",
    "createCliCore",
    "discoverProjectConnection",
    "doctorProject",
    "handlePendingAction",
    "listInstalledLooms",
    "removeLoom",
    "runCli",
    "serviceStatus",
    "startProjectHost",
    "startService",
    "stopService",
  ]);
  for (const value of Object.values(api))
    assert.equal(typeof value, "function");
  const core = api.createCliCore();
  assert.deepEqual(Object.keys(core).sort(), [
    "addLoomPackage",
    "answerAsk",
    "applyMcpConfig",
    "buildLoom",
    "callAgentTool",
    "cancelRun",
    "checkLoom",
    "claimAgentCall",
    "completeAgentCall",
    "doctor",
    "exportMirrors",
    "failAgentCall",
    "findRun",
    "getAgentCall",
    "getArtifact",
    "getOperation",
    "getRecord",
    "getRun",
    "getServiceStatus",
    "initProject",
    "inspectLoom",
    "inspectMirror",
    "inspectProject",
    "listArtifacts",
    "listLoomPackages",
    "listLooms",
    "listMirrors",
    "listRecords",
    "listRuns",
    "pauseRun",
    "planMcpConfig",
    "readAgentAsset",
    "readLogs",
    "readProjectConfig",
    "recoverProject",
    "removeLoomPackage",
    "restoreMirror",
    "resumeRun",
    "run",
    "scaffoldLoom",
    "startService",
    "stopService",
    "updateProjectConfig",
    "waitRun",
    "watchLogs",
    "watchProject",
    "watchRun",
  ]);
  for (const value of Object.values(core))
    assert.equal(typeof value, "function");
});

test("all command help paths match the supported options and descriptions", async () => {
  const snapshots = JSON.parse(
    await readFile(
      new URL("../test/fixtures/help.json", import.meta.url),
      "utf8",
    ),
  ) as { args: string[]; output: string }[];
  assert.equal(snapshots.length, 45);
  const entry = process.argv[1];
  assert.ok(entry);
  for (const snapshot of snapshots) {
    const output = new PassThrough(),
      error = new PassThrough();
    let stdout = "",
      stderr = "";
    output.on("data", (chunk) => {
      stdout += chunk;
    });
    error.on("data", (chunk) => {
      stderr += chunk;
    });
    const code = await api.runCli([...snapshot.args, "--help", "--no-color"], {
      input: new PassThrough(),
      output,
      error,
      cwd: process.cwd(),
      isTTY: false,
    });
    assert.equal(code, 0, snapshot.args.join(" "));
    assert.equal(stderr, "");
    assert.equal(
      stdout
        .replaceAll(packageVersion, "<version>")
        .replaceAll(entry, "<entry>"),
      snapshot.output,
      snapshot.args.join(" "),
    );
  }
});
