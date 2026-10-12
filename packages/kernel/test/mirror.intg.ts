import { startProjectHost } from "../src/service/host.ts";
import { initializeProject } from "../src/core/initialize-project.ts";
import { createEffector } from "../src/effector/create-effector.ts";
import { openFileStorage } from "../src/storage/file/open.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  readFile,
  lstat,
  writeFile,
  rm,
  mkdir,
  symlink,
  chmod,
  readdir,
} from "node:fs/promises";
import {
  mirrorProject,
  mirrorWorkflow,
  openMirrorProject,
  snapshot,
  stable,
} from "./mirror-fixture.ts";
import { flow } from "../src/core/execution.ts";
import {
  restoreMirror,
  listMirrors,
  inspectMirror,
  exportMirrors,
} from "../src/service/application/mirrors.ts";
import { findMirror, readMirrorDirectory } from "../src/mirror/coordinator.ts";
import type { MirrorManifest } from "../src/mirror/contracts.ts";
import { scanFiles, validateFilePaths } from "../src/mirror/files.ts";
import { createWriteGate } from "../src/mirror/write-gate.ts";
import { setImmediate } from "node:timers/promises";

for (const backend of ["file", "sqlite"] as const)
  test(`${backend}: immutable full images, scopes, paused restart, current Code and upstream data`, async (t) => {
    const source = await mirrorProject(t, backend);
    await mkdir(join(source.root, "inputs"));
    await writeFile(join(source.root, "inputs/empty"), "");
    await chmod(join(source.root, "inputs/empty"), 0o700);
    const original = await openMirrorProject(source.root, backend);
    t.after(() => original.close());
    const done = await flow(
      original.execution,
      "mirror-case",
      "deterministic tiny project",
    );
    assert.equal(done.status, "completed", JSON.stringify(done));
    await stable(original.execution, done.runId);
    const images = (await listMirrors(source.root)) as MirrorManifest[];
    assert.equal(images.length, 14);
    assert.equal(new Set(images.map((x) => x.mirrorId)).size, images.length);
    assert.deepEqual(
      images
        .filter((x) => x.boundary.kind === "step_before")
        .map((x) => x.boundary.stepVisitId)
        .sort(),
      [1, 2, 3],
    );
    const before = images.find(
      (x) => x.boundary.kind === "step_before" && x.boundary.stepVisitId === 2,
    );
    assert.ok(before);
    const after = images.find(
      (x) => x.boundary.kind === "step_after" && x.boundary.stepVisitId === 2,
    );
    assert.ok(after);
    const end = images.find(
      (x) => x.boundary.kind === "stage_end" && x.boundary.stageVisitId === 1,
    );
    assert.ok(end);
    const start = images.find(
      (x) => x.boundary.kind === "stage_start" && x.boundary.stageVisitId === 1,
    );
    assert.ok(start);
    const pre = images.find(
      (x) =>
        x.boundary.kind === "stage_before_init" &&
        x.boundary.stageVisitId === 1,
    );
    assert.ok(pre);
    const beforeImage = await readMirrorDirectory(
      await findMirror(source.root, before.mirrorId),
    );
    assert.equal(beforeImage.storage.artifacts[0]?.revision, 1);
    assert.equal(
      beforeImage.checkpoint.stage?.value &&
        typeof beforeImage.checkpoint.stage.value === "object" &&
        !Array.isArray(beforeImage.checkpoint.stage.value)
        ? beforeImage.checkpoint.stage.value.n
        : null,
      1,
    );
    const sourceBytes = await readFile(
      join(beforeImage.directory, "checkpoint.json"),
    );
    const target = await mirrorProject(
      t,
      backend,
      mirrorWorkflow({ delta: 10 }),
    );
    const restored = await restoreMirror({
      sourceProject: source.root,
      mirrorId: before.mirrorId,
      targetProject: target.root,
      scope: "step",
    });
    assert.equal(restored.status, "paused");
    assert.equal(restored.warnings.length, 1);
    assert.notEqual(restored.traceId, before.traceId);
    assert.deepEqual(
      (await inspectMirror(source.root, before.mirrorId)).integrity,
      { valid: true },
    );
    assert.equal(
      await readFile(join(target.workflowRoot, "workflow.js"), "utf8"),
      mirrorWorkflow({ delta: 10 }),
    );
    let branch = await openMirrorProject(target.root, backend);
    assert.equal(
      (await branch.execution.runtime.getRun(done.runId)).status,
      "paused",
    );
    assert.deepEqual(await snapshot(branch.storage), beforeImage.storage);
    const paused = await branch.execution.runtime.getRun(done.runId);
    assert.ok(paused.revision);
    assert.ok(paused.serviceInstanceId);
    const op = {
      operationId: randomUUID(),
      expectedRevision: paused.revision,
      serviceInstanceId: paused.serviceInstanceId,
    };
    const accepted = await branch.execution.runtime.resumeRun(done.runId, op);
    const stopped = await stable(branch.execution, done.runId);
    assert.equal(stopped.status, "paused");
    assert.equal(stopped.control?.pauseReason, "scope_completed");
    assert.equal(
      await readFile(join(target.root, "src/value.json"), "utf8"),
      '{"n":11}',
    );
    assert.equal((await branch.storage.access.listRecords({})).data.length, 2);
    assert.deepEqual(
      await branch.execution.runtime.resumeRun(done.runId, op),
      accepted,
    );
    assert.equal((await branch.storage.access.listRecords({})).data.length, 2);
    await assert.rejects(
      branch.execution.runtime.resumeRun(done.runId, {
        operationId: randomUUID(),
      }),
      /explicit new scope/u,
    );
    await branch.close();
    // Reopening does not apply the saved outcome or initialize the next Stage.
    branch = await openMirrorProject(target.root, backend);
    t.after(() => branch.close());
    assert.equal(
      (await branch.execution.runtime.getRun(done.runId)).status,
      "paused",
    );
    assert.equal(
      await branch.storage.access.getLatestRecord("mirror-case", "second"),
      undefined,
    );
    await assert.rejects(flow(branch.execution, "mirror-case", "another"), {
      code: "BUSY",
    });
    await branch.execution.runtime.resumeRun(done.runId, {
      operationId: randomUUID(),
      scope: "workflow",
    });
    assert.equal(
      (await stable(branch.execution, done.runId)).status,
      "completed",
    );
    assert.equal(
      (await branch.storage.access.getLatestRecord("mirror-case", "second"))
        ?.data &&
        (await branch.storage.access.getArtifact("mirror-case", "first"))
          ?.revision,
      2,
    );
    assert.deepEqual(
      await readFile(join(beforeImage.directory, "checkpoint.json")),
      sourceBytes,
    );
    // stage scope completes the current visit, leaves next Stage pending, and does not reinitialize restored current State.
    const stageTarget = await mirrorProject(
      t,
      backend,
      mirrorWorkflow({ failInit: true }),
    );
    await restoreMirror({
      sourceProject: source.root,
      mirrorId: start.mirrorId,
      targetProject: stageTarget.root,
      scope: "stage",
    });
    const stageBranch = await openMirrorProject(stageTarget.root, backend);
    t.after(() => stageBranch.close());
    await stageBranch.execution.runtime.resumeRun(done.runId, {
      operationId: randomUUID(),
    });
    const stageStopped = await stable(stageBranch.execution, done.runId);
    assert.equal(stageStopped.status, "paused");
    assert.equal(stageStopped.cursor.stageName, "second");
    assert.equal(
      await stageBranch.storage.access.getLatestRecord("mirror-case", "second"),
      undefined,
    );
    const checkpointFiles = await readdir(
      join(stageTarget.root, ".intloom/runtime"),
    );
    const saved = JSON.parse(
      await readFile(
        join(stageTarget.root, ".intloom/runtime", checkpointFiles[0] ?? ""),
        "utf8",
      ),
    );
    assert.equal(saved.stage.role, "exited");
    // before-init tries the current initializer and classifies later failure as execution failure.
    const initTarget = await mirrorProject(
      t,
      backend,
      mirrorWorkflow({ failInit: true }),
    );
    await restoreMirror({
      sourceProject: source.root,
      mirrorId: pre.mirrorId,
      targetProject: initTarget.root,
      scope: "stage",
    });
    const initBranch = await openMirrorProject(initTarget.root, backend);
    t.after(() => initBranch.close());
    await initBranch.execution.runtime.resumeRun(done.runId, {
      operationId: randomUUID(),
    });
    const initFailed = await stable(initBranch.execution, done.runId);
    assert.equal(initFailed.lastError?.code, "RUN_INITIALIZATION_FAILED");
    const initImages = (await listMirrors(initTarget.root)) as MirrorManifest[];
    assert.equal(
      initImages.some((x) => x.boundary.kind === "stage_start"),
      false,
    );
    // step_after applies the saved result once; stage_end never binds exited State to a different Schema.
    for (const image of [after, end]) {
      const target = await mirrorProject(
        t,
        backend,
        mirrorWorkflow({ delta: 100 }),
      );
      await restoreMirror({
        sourceProject: source.root,
        mirrorId: image.mirrorId,
        targetProject: target.root,
        scope: "workflow",
      });
      const branch = await openMirrorProject(target.root, backend);
      t.after(() => branch.close());
      await branch.execution.runtime.resumeRun(done.runId, {
        operationId: randomUUID(),
      });
      assert.equal(
        (await stable(branch.execution, done.runId)).status,
        "completed",
      );
      assert.equal(
        (await branch.storage.access.getArtifact("mirror-case", "first"))
          ?.data &&
          (await readFile(join(target.root, "src/value.json"), "utf8")),
        '{"n":2}',
      );
    }
    // Scope, Schema and target conflicts are preflight errors; no automatic repair or overwrite.
    for (const [image, scope] of [
      [after, "step"],
      [end, "stage"],
    ] as const) {
      const target = await mirrorProject(t, backend);
      await assert.rejects(
        restoreMirror({
          sourceProject: source.root,
          mirrorId: image.mirrorId,
          targetProject: target.root,
          scope,
        }),
        { code: "MIRROR_RESTORE_FAILED" },
      );
      assert.deepEqual(await readdir(target.root), [
        ".intloom",
        "intloom.yaml",
      ]);
    }
    const incompatible = await mirrorProject(
      t,
      backend,
      mirrorWorkflow({ invalidSchema: true }),
    );
    await assert.rejects(
      restoreMirror({
        sourceProject: source.root,
        mirrorId: before.mirrorId,
        targetProject: incompatible.root,
        scope: "workflow",
      }),
      { code: "MIRROR_RESTORE_FAILED" },
    );
    const conflict = await mirrorProject(t, backend);
    await mkdir(join(conflict.root, "src"));
    await writeFile(join(conflict.root, "src/value.json"), "keep");
    await assert.rejects(
      restoreMirror({
        sourceProject: source.root,
        mirrorId: before.mirrorId,
        targetProject: conflict.root,
        scope: "workflow",
      }),
      { code: "MIRROR_RESTORE_FAILED" },
    );
    assert.equal(
      await readFile(join(conflict.root, "src/value.json"), "utf8"),
      "keep",
    );
    for (const failAt of ["import", "files", "checkpoint"] as const) {
      const target = await mirrorProject(t, backend);
      await assert.rejects(
        restoreMirror(
          {
            sourceProject: source.root,
            mirrorId: before.mirrorId,
            targetProject: target.root,
            scope: "workflow",
          },
          { failAt },
        ),
        { code: "MIRROR_RESTORE_FAILED" },
      );
      assert.equal((await readdir(target.root)).includes("intloom"), false);
      assert.equal(
        (await readdir(join(target.root, ".intloom"))).includes("restore.lock"),
        false,
      );
    }
    const exportTarget = join(source.root, "..", `export-${randomUUID()}`);
    t.after(() => rm(exportTarget, { recursive: true, force: true }));
    await rm(source.workflowRoot, { recursive: true });
    assert.equal(
      (await inspectMirror(source.root, before.mirrorId)).integrity.valid,
      true,
    );
    assert.equal(
      (await exportMirrors(source.root, before.traceId, exportTarget)).mirrors,
      images.length,
    );
    assert.deepEqual(
      await readFile(join(exportTarget, before.mirrorId, "checkpoint.json")),
      sourceBytes,
    );
  });

test("safe file manifests reject case normalization, traversal and target Code conflicts", () => {
  assert.throws(
    () =>
      validateFilePaths({
        schemaVersion: 1,
        entries: [
          { type: "directory", path: "A" },
          { type: "directory", path: "a" },
        ],
        includes: [],
        excluded: [],
      }),
    /normalized/u,
  );
  for (const path of [
    "../escape",
    "/absolute",
    "x/../escape",
    ".intloom/workflows/file",
    "src/file",
  ]) {
    assert.throws(() =>
      validateFilePaths(
        {
          schemaVersion: 1,
          entries: [{ type: "directory", path }],
          includes: [],
          excluded: [],
        },
        { protectedPaths: ["src/file"] },
      ),
    );
  }
});

test("safe file scan rejects case collisions on case-sensitive filesystems", async (t) => {
  const p = await mirrorProject(t, "file");
  await writeFile(join(p.root, "case.txt"), "one");
  try {
    await writeFile(join(p.root, "Case.txt"), "two", { flag: "wx" });
  } catch (cause) {
    if (!(cause instanceof Error && "code" in cause && cause.code === "EEXIST"))
      throw cause;
    t.skip("Filesystem cannot create distinct case.txt and Case.txt entries.");
    return;
  }
  await assert.rejects(
    scanFiles(p.root, {}),
    /Case or Unicode normalization conflict/u,
  );
});

test("safe file scan rejects symlinks", async (t) => {
  const p = await mirrorProject(t, "file");
  await symlink("/tmp", join(p.root, "external"));
  await assert.rejects(scanFiles(p.root, {}), /Symbolic link/u);
});
test("capture write gate waits for already admitted work and rejects new writes during capture", async () => {
  const gate = createWriteGate();
  let release!: () => void;
  const accepted = new Promise<void>((r) => {
    release = r;
  });
  let settled = false;
  const project = gate.project({
    snapshot: async () => ({}),
    read: async () => "",
    write: async () => {
      await accepted;
      settled = true;
    },
    remove: async () => {},
    run: async () => {
      throw new Error("unused");
    },
  });
  const write = project.write("x", "value");
  const capture = gate.capture(async () => {
    assert.equal(settled, true);
    assert.throws(() => gate.assertOpen(), { code: "BUSY" });
  });
  await setImmediate();
  release();
  await Promise.all([write, capture]);
  gate.assertOpen();
});

test("corrupt manifests and data refuse executable restore; current imported Code files stay protected", async (t) => {
  const source = await mirrorProject(t, "file");
  await mkdir(join(source.root, "src"));
  await writeFile(
    join(source.root, "src/code.mjs"),
    "export const marker='snapshot business file';",
  );
  const host = await openMirrorProject(source.root, "file");
  const done = await flow(host.execution, "mirror-case", "integrity");
  await stable(host.execution, done.runId);
  const images = (await listMirrors(source.root)) as MirrorManifest[];
  const image = images.find(
    (x) => x.boundary.kind === "step_before" && x.boundary.stepVisitId === 2,
  );
  assert.ok(image);
  const directory = await findMirror(source.root, image.mirrorId);
  const target = await mirrorProject(t, "file");
  await mkdir(join(target.root, "src"));
  await writeFile(
    join(target.root, "src/code.mjs"),
    "export const marker='current Workflow Code';",
  );
  const code = await readFile(join(target.workflowRoot, "workflow.js"), "utf8");
  await writeFile(
    join(target.workflowRoot, "workflow.js"),
    `import {marker} from ${JSON.stringify(new URL(`file://${join(target.root, "src/code.mjs")}`).href)};\n${code}`,
  );
  await assert.rejects(
    restoreMirror({
      sourceProject: source.root,
      mirrorId: image.mirrorId,
      targetProject: target.root,
      scope: "workflow",
    }),
    /protected target path: src\/code.mjs/u,
  );
  assert.match(
    await readFile(join(target.root, "src/code.mjs"), "utf8"),
    /current Workflow Code/u,
  );
  const original = await readFile(join(directory, "checkpoint.json"));
  for (const corrupted of [
    "{",
    "{}",
    original.toString().replace('"schemaVersion":2', '"schemaVersion":99'),
  ]) {
    await writeFile(join(directory, "checkpoint.json"), corrupted);
    const target = await mirrorProject(t, "file");
    await assert.rejects(
      restoreMirror({
        sourceProject: source.root,
        mirrorId: image.mirrorId,
        targetProject: target.root,
        scope: "workflow",
      }),
      { code: "MIRROR_RESTORE_FAILED" },
    );
  }
  await writeFile(join(directory, "checkpoint.json"), original);
  await rm(join(directory, "files/src/value.json"));
  assert.equal(
    (await inspectMirror(source.root, image.mirrorId)).integrity.valid,
    false,
  );
  const target2 = await mirrorProject(t, "sqlite");
  await assert.rejects(
    restoreMirror({
      sourceProject: source.root,
      mirrorId: images[0]?.mirrorId ?? "",
      targetProject: target2.root,
      scope: "workflow",
    }),
    { code: "MIRROR_RESTORE_FAILED" },
  );
});

test("two restores of one image stay independent; later initialization, entry stage scope and commit markers remain exact", async (t) => {
  const source = await mirrorProject(t, "file");
  const origin = await openMirrorProject(source.root, "file");
  const done = await flow(origin.execution, "mirror-case", "remaining matrix");
  await stable(origin.execution, done.runId);
  const images = (await listMirrors(source.root)) as MirrorManifest[];
  const before = images.find(
    (x) => x.boundary.kind === "step_before" && x.boundary.stepVisitId === 2,
  );
  assert.ok(before);
  const laterInit = images.find(
    (x) =>
      x.boundary.kind === "stage_before_init" && x.boundary.stageVisitId === 2,
  );
  assert.ok(laterInit);
  const workflowStart = images.find(
    (x) => x.boundary.kind === "workflow_start",
  );
  assert.ok(workflowStart);
  const after = images.find(
    (x) => x.boundary.kind === "step_after" && x.boundary.stepVisitId === 2,
  );
  assert.ok(after);
  const twins = [];
  for (const delta of [10, 20]) {
    const target = await mirrorProject(t, "file", mirrorWorkflow({ delta }));
    const restored = await restoreMirror({
      sourceProject: source.root,
      mirrorId: before.mirrorId,
      targetProject: target.root,
      scope: "step",
    });
    const host = await openMirrorProject(target.root, "file");
    await host.execution.runtime.resumeRun(done.runId, {
      operationId: randomUUID(),
    });
    const result = await stable(host.execution, done.runId);
    assert.equal(result.status, "paused");
    await host.close();
    twins.push({ target, restored });
  }
  assert.notEqual(twins[0]?.restored.traceId, twins[1]?.restored.traceId);
  assert.equal(
    await readFile(join(twins[0]?.target.root ?? "", "src/value.json"), "utf8"),
    '{"n":11}',
  );
  assert.equal(
    await readFile(join(twins[1]?.target.root ?? "", "src/value.json"), "utf8"),
    '{"n":21}',
  );
  const imageDirectory = await findMirror(source.root, before.mirrorId);
  assert.notEqual(
    (await lstat(join(twins[0]?.target.root ?? "", "src/value.json"))).ino,
    (await lstat(join(imageDirectory, "files/src/value.json"))).ino,
  );
  const first = twins[0];
  assert.ok(first);
  await assert.rejects(
    restoreMirror({
      sourceProject: source.root,
      mirrorId: before.mirrorId,
      targetProject: first.target.root,
      scope: "workflow",
    }),
    /existing business Storage or checkpoints/u,
  );
  assert.equal(
    await readFile(join(first.target.root, "src/value.json"), "utf8"),
    '{"n":11}',
  );
  // A later Stage initializer is tested without running the earlier (now failing) initializer.
  const second = await mirrorProject(
    t,
    "file",
    mirrorWorkflow({ failInit: true }),
  );
  await restoreMirror({
    sourceProject: source.root,
    mirrorId: laterInit.mirrorId,
    targetProject: second.root,
    scope: "stage",
  });
  const later = await openMirrorProject(second.root, "file");
  await later.execution.runtime.resumeRun(done.runId, {
    operationId: randomUUID(),
  });
  const laterDone = await stable(later.execution, done.runId);
  assert.equal(laterDone.status, "completed");
  assert.equal(laterDone.control?.stageVisitId, 2);
  assert.equal(laterDone.control?.scope.completed, true);
  const entry = await mirrorProject(t, "file");
  const entryRestored = await restoreMirror({
    sourceProject: source.root,
    mirrorId: workflowStart.mirrorId,
    targetProject: entry.root,
    scope: "stage",
  });
  assert.deepEqual(entryRestored.scopeTarget, {
    stageName: "first",
    stageVisitId: 1,
  });
  const entryHost = await openMirrorProject(entry.root, "file");
  await entryHost.execution.runtime.resumeRun(done.runId, {
    operationId: randomUUID(),
  });
  const stopped = await stable(entryHost.execution, done.runId);
  assert.equal(stopped.status, "paused");
  assert.equal(stopped.cursor.stageName, "second");
  // Current Schema key order is irrelevant; saved outcome routing must still agree.
  const reordered = await mirrorProject(
    t,
    "file",
    mirrorWorkflow().replace(
      "n:z.number(),runId:z.string()",
      "runId:z.string(),n:z.number()",
    ),
  );
  await restoreMirror({
    sourceProject: source.root,
    mirrorId: before.mirrorId,
    targetProject: reordered.root,
    scope: "step",
  });
  const rerouted = await mirrorProject(
    t,
    "file",
    mirrorWorkflow().replace(
      "done:{kind:'stage_end'}",
      "done:{kind:'step',stepName:'work'}",
    ),
  );
  await assert.rejects(
    restoreMirror({
      sourceProject: source.root,
      mirrorId: after.mirrorId,
      targetProject: rerouted.root,
      scope: "workflow",
    }),
    /different route/u,
  );
  const sqlite = await mirrorProject(t, "sqlite");
  await assert.rejects(
    restoreMirror({
      sourceProject: source.root,
      mirrorId: workflowStart.mirrorId,
      targetProject: sqlite.root,
      scope: "stage",
    }),
    /same backend type/u,
  );
  await assert.rejects(
    restoreMirror({
      sourceProject: source.root,
      mirrorId: before.mirrorId,
      targetProject: source.root,
      scope: "workflow",
    }),
    /independent/u,
  );
  const shared = await mirrorProject(t, "file");
  await symlink(join(source.root, "intloom"), join(shared.root, "intloom"));
  await assert.rejects(
    restoreMirror({
      sourceProject: source.root,
      mirrorId: before.mirrorId,
      targetProject: shared.root,
      scope: "workflow",
    }),
    /Symbolic link/u,
  );
  // An incomplete marker stops the real host before opening formal Storage.
  const incomplete = await mirrorProject(t, "file");
  await writeFile(
    join(incomplete.root, ".intloom/restore.lock"),
    JSON.stringify({ commitId: randomUUID(), createdPaths: [] }),
  );
  await assert.rejects(
    startProjectHost({ projectRoot: incomplete.root, port: 0 }),
    { code: "MIRROR_RESTORE_INCOMPLETE" },
  );
  assert.equal((await readdir(incomplete.root)).includes("intloom"), false);
  const commitId =
    first.restored.scope &&
    JSON.parse(
      await readFile(
        join(
          first.target.root,
          ".intloom/runtime",
          (await readdir(join(first.target.root, ".intloom/runtime")))[0] ?? "",
        ),
        "utf8",
      ),
    ).control.restoreCommitId;
  await rm(join(first.target.root, ".intloom/restores", `${commitId}.json`));
  const formal = await openFileStorage({
    directory: join(first.target.root, "intloom"),
    layout: "directories",
  });
  try {
    await assert.rejects(
      initializeProject(first.target.root, {
        storage: formal.access,
        storageHandle: formal,
        effector: createEffector(),
        runtimeDirectory: join(first.target.root, ".intloom/runtime"),
      }),
    );
  } finally {
    await formal.dispose();
  }
  assert.equal(
    await readFile(join(first.target.root, "src/value.json"), "utf8"),
    '{"n":11}',
  );
  // Unknown versions remain inspectable as raw data and cannot execute restore.
  const rawManifest = await readFile(join(imageDirectory, "mirror.json"));
  const manifest = JSON.parse(rawManifest.toString());
  await writeFile(
    join(imageDirectory, "mirror.json"),
    JSON.stringify({
      ...manifest,
      schemaVersion: 99,
      futureField: "preserved",
    }),
  );
  const inspected = await inspectMirror(source.root, before.mirrorId);
  assert.equal(inspected.integrity.valid, false);
  assert.equal(
    (inspected["mirror.json"] as { futureField: string }).futureField,
    "preserved",
  );
  const unknown = await mirrorProject(t, "file");
  await assert.rejects(
    restoreMirror({
      sourceProject: source.root,
      mirrorId: before.mirrorId,
      targetProject: unknown.root,
      scope: "step",
    }),
    { code: "MIRROR_RESTORE_FAILED" },
  );
  await writeFile(join(imageDirectory, "mirror.json"), rawManifest);
  await rm(
    join(source.root, ".intloom/mirrors/runs", before.traceId, "run.json"),
  );
  assert.equal((await listMirrors(source.root)).length, images.length);
});
