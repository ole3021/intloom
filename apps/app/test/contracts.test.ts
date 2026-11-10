import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { createSeed, MockService, recoverOnOpen } from "../src/mock/service.ts";
import { getRun, listRuns, overview } from "../src/mock/queries.ts";
import { getRunActivity } from "../src/mock/activity.ts";
import { copyArtifact, registerArtifact } from "../src/main/artifacts.ts";
import { candidateReady } from "../src/mock/lifecycle.ts";
import { loadState } from "../src/mock/persistence.ts";
import { catalog } from "../src/shared/catalog.ts";
import { packageInfo, row } from "../src/main/projections.ts";
import type { InstalledLoom, RunSummary } from "@intloom/loom-sdk";

test("mock commands match the 0.4 catalog contracts and accept their minimum inputs", async () => {
  const s = new MockService(createSeed());
  for (const id of ["ppt-generator", "photo-editor"]) {
    const manifest = parse(
      await readFile(new URL(`./fixtures/${id}.yaml`, import.meta.url), "utf8"),
    );
    const pkg = catalog.find((p) => p.ref.id === id);
    assert.ok(pkg);
    assert.equal(pkg.ref.version, manifest.version);
    assert.deepEqual(
      pkg.commands.map((c) => c.name).sort(),
      Object.keys(manifest.commands).sort(),
    );
    assert.equal(
      pkg.defaultCommand,
      manifest.defaultCommand ?? Object.keys(manifest.commands)[0],
    );
    for (const c of pkg.commands) {
      const properties = Object.fromEntries(
        Object.entries(c.input.properties).map(
          ([key, { title, format, ...schema }]) => [key, schema],
        ),
      );
      assert.deepEqual(
        { ...c.input, properties },
        manifest.commands[c.name].input,
      );
      assert.equal(c.output, manifest.commands[c.name].output);
    }
  }
  const draft = {
    loom: "ppt-generator",
    command: "generate",
    projectDir: "",
    profileId: "",
    finalConfirmation: false,
    input: { goal: "正式输入" },
  };
  assert.ok(s.apply({ type: "launch", draft }).receipt);
  assert.throws(() =>
    s.apply({
      type: "launch",
      draft: { ...draft, input: { ...draft.input, title: "旧演练字段" } },
    }),
  );
  assert.throws(() =>
    s.apply({
      type: "launch",
      draft: { ...draft, input: { ...draft.input, pages: 31 } },
    }),
  );
  assert.ok(
    s.apply({
      type: "launch",
      draft: {
        ...draft,
        loom: "photo-editor",
        command: "learn",
        input: { name: "风格", pairs: [{ raw: "a.raw", edited: "b.jpg" }] },
      },
    }).receipt,
  );
  assert.ok(
    s.apply({
      type: "launch",
      draft: {
        ...draft,
        loom: "photo-editor",
        command: "apply",
        input: { directory: "photos", profile: "style.json" },
      },
    }).receipt,
  );
});
test("test actor cannot approve human requests; pending sibling requests survive a response", () => {
  const s = new MockService(createSeed());
  const r = s.state.runs.find((r) => r.summary.id === "R-1048");
  assert.ok(r);
  const first = r.requests[0],
    second = { ...first, id: `${first.id}-second` };
  r.requests.push(second);
  r.summary = {
    ...r.summary,
    waits: [
      ...r.summary.waits,
      { ...r.summary.waits[0], waitId: second.id, requestId: second.id },
    ],
    pendingInteractionIds: [first.id, second.id],
  };
  assert.equal(getRun(s.state, r.summary.id)?.reviews.length, 2);
  const answer = { type: "answer" as const, requestId: first.id, value: true };
  assert.throws(() => s.apply(answer, "test"), /RESPONSE_SOURCE_NOT_ALLOWED/);
  assert.equal(r.answers.length, 0);
  assert.equal(
    s.apply(answer, "human").interaction?.continuation.status,
    "requested",
  );
  assert.deepEqual(r.summary.pendingInteractionIds, [second.id]);
  assert.deepEqual(
    getRun(s.state, r.summary.id)?.reviews.map((x) => x.request.id),
    [second.id],
  );
  assert.equal(r.summary.status, "waiting");
  s.apply({ ...answer, requestId: second.id }, "human");
  assert.equal(r.summary.status, "running");
  assert.deepEqual(
    r.answers.map((a) => a.requestId),
    [first.id, second.id],
  );
});
test("a saved answer can retry its exact wait after reinstall without resubmitting", () => {
  const s = new MockService(createSeed());
  const run = s.state.runs.find((r) => r.summary.id === "R-1050");
  assert.ok(run);
  const q = run.requests[0];
  s.apply({ type: "catalog", id: run.launch.loom, install: false });
  const receipt = s.apply(
    { type: "answer", requestId: q.id, value: "团队" },
    "test",
  ).interaction;
  assert.equal(receipt?.continuation.status, "needs_attention");
  assert.equal(run.answers[0].source.kind, "test");
  assert.equal(run.summary.status, "waiting");
  s.apply({ type: "catalog", id: run.launch.loom, install: true });
  assert.throws(() =>
    s.apply({ type: "resume", id: run.summary.id, waitId: "wrong" }),
  );
  assert.equal(
    s.apply({ type: "resume", id: run.summary.id, waitId: q.id }).receipt?.run
      .id,
    run.summary.id,
  );
  assert.equal(run.answers.length, 1);
});
test("restart keeps stable waits and interrupted retry creates a new Run with the original input", () => {
  const s = new MockService(createSeed());
  recoverOnOpen(s.state);
  const interrupted = getRun(s.state, "R-1043"),
    waiting = getRun(s.state, "R-1044");
  assert.ok(interrupted && waiting);
  assert.equal(waiting.summary.waits[0].kind, "external");
  assert.throws(() =>
    s.apply({
      type: "resume",
      id: interrupted.summary.id,
      waitId: "R-1044-proof",
    }),
  );
  const retried = s.apply({
    type: "launch",
    draft: interrupted.launch,
  }).receipt;
  assert.ok(retried);
  assert.notEqual(retried.run.id, interrupted.summary.id);
  assert.deepEqual(getRun(s.state, retried.run.id)?.launch, interrupted.launch);
  assert.equal(getRun(s.state, "R-1043")?.summary.status, "interrupted");
});
test("stable simultaneous waits survive reopening, and each answer remains independent in the detail view", () => {
  const s = new MockService(createSeed());
  const r = s.state.runs.find((r) => r.summary.id === "R-1052");
  assert.ok(r);
  r.summary = { ...r.summary, status: "running" };
  recoverOnOpen(s.state);
  assert.equal(r.summary.status, "waiting");
  const [a, b] = getRun(s.state, r.summary.id)?.reviews ?? [];
  assert.ok(a && b);
  s.apply(
    { type: "answer", requestId: a.request.id, value: "业务团队" },
    "test",
  );
  assert.deepEqual(
    getRun(s.state, r.summary.id)?.reviews.map((x) => x.request.id),
    [b.request.id],
  );
  s.apply(
    { type: "answer", requestId: b.request.id, value: "试点反馈" },
    "test",
  );
  assert.equal(r.summary.status, "running");
});
test("a missing or modified fixed version cannot be opened or exported; list reads are independent", async () => {
  const state = createSeed(),
    run = state.runs.find((r) => r.candidate);
  assert.ok(run);
  const dir = await mkdtemp(join(tmpdir(), "intloom-immutable-"));
  try {
    run.artifact = await registerArtifact(dir, run);
    candidateReady(run, run.summary.updatedAt);
    const path = join(dir, "artifacts", run.summary.id, run.artifact.name);
    const modified = Buffer.alloc(run.artifact.size, 42);
    await writeFile(path, modified);
    await assert.rejects(
      copyArtifact(dir, run.artifact),
      /ARTIFACT_UNAVAILABLE/,
    );
    await assert.rejects(
      copyArtifact(dir, run.artifact, dir),
      /ARTIFACT_UNAVAILABLE/,
    );
    await unlink(path);
    await assert.rejects(
      copyArtifact(dir, run.artifact, dir),
      /ARTIFACT_UNAVAILABLE/,
    );
    assert.ok(overview(state).runs.length);
    assert.equal(
      getRun(state, run.summary.id)?.activity.artifacts[0].digest,
      run.artifact.digest,
    );
    await assert.rejects(readFile(join(dir, run.artifact.name)), {
      code: "ENOENT",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("overview and paginated history contain summaries; detail is independent of recent history", () => {
  const state = createSeed(),
    base = state.runs.find((r) => r.candidate);
  assert.ok(base);
  candidateReady(base, base.summary.updatedAt);
  for (let i = 0; i < 40; i++) {
    const r = structuredClone(base);
    r.summary = { ...r.summary, id: `history-${i}` };
    state.runs.push(r);
  }
  const dash = overview(state);
  assert.equal(
    dash.runs.filter((r) => r.summary.status === "succeeded").length,
    5,
  );
  const first = listRuns(state, { status: "succeeded", limit: 25 });
  assert.equal(first.items.length, 25);
  assert.ok(first.nextCursor);
  const second = listRuns(state, {
    status: "succeeded",
    limit: 25,
    cursor: first.nextCursor,
  });
  assert.equal(
    new Set([...first.items, ...second.items].map((r) => r.summary.id)).size,
    41,
  );
  for (const item of [...dash.runs, ...first.items])
    for (const key of [
      "events",
      "launch",
      "answers",
      "steps",
      "nextAt",
      "stage",
      "position",
    ])
      assert.ok(!(key in item));
  assert.ok(getRun(state, "history-0")?.events.length);
});
test("activity preserves failed receipts and never claims missing token coverage", () => {
  const run = createSeed().runs.find((r) => r.candidate);
  assert.ok(run);
  run.events = run.events.map((e) =>
    e.type === "model.invocation.finished"
      ? { ...e, details: { ...e.details, status: "failed" } }
      : e,
  );
  assert.equal(getRunActivity(run).recentExecutions[0].status, "failed");
  run.events = run.events.map((e) =>
    e.type === "model.invocation.finished"
      ? { ...e, details: { ...e.details, status: "succeeded" } }
      : e.type === "model.step.finished"
        ? {
            ...e,
            details: {
              invocationId: e.details.invocationId,
              step: e.details.step,
            },
          }
        : e,
  );
  const usage = getRunActivity(run).usage;
  assert.equal(usage.complete, false);
  assert.equal(usage.inputTokens.receipts, 0);
});
test("independent settings edits merge and a rejected resource edit leaves saved state intact", () => {
  const s = new MockService(createSeed());
  s.apply({ type: "preferences", patch: { theme: "dark" } });
  s.apply({ type: "projectDefault", project: "/A", profileId: "quality" });
  s.apply({ type: "projectDefault", project: "/B", profileId: "daily" });
  s.apply({ type: "preferences", patch: { notifications: false } });
  assert.equal(s.state.settings.theme, "dark");
  assert.equal(s.state.settings.notifications, false);
  assert.equal(s.state.settings.projects["/A"], "quality");
  assert.equal(s.state.settings.projects["/B"], "daily");
  const initial = structuredClone(s.state.settings.credentials[0]);
  assert.throws(() =>
    s.apply({
      type: "saveResource",
      resource: {
        kind: "credentials",
        value: { ...initial, env: "invalid secret" },
      },
    }),
  );
  assert.deepEqual(s.state.settings.credentials[0], initial);
});
test("old demo history remains readable and retry chooses the matching demo form", () => {
  const original = createSeed();
  const run = original.runs.find((r) => r.launch.loom === "demo-presentation");
  assert.ok(run);
  run.launch.loom = "ppt-generator";
  run.summary = {
    ...run.summary,
    loom: { ...run.summary.loom, id: "ppt-generator" },
  };
  const migrated = loadState(
    JSON.stringify({
      ...original,
      schemaVersion: 1,
      installed: ["ppt-generator"],
    }),
  );
  const detail = getRun(migrated, run.summary.id);
  assert.ok(detail);
  assert.equal(detail.summary.loom.id, "ppt-generator");
  assert.equal(detail.launch.loom, "ppt-generator");
  assert.equal(detail.retryLoom, "demo-presentation");
  assert.ok(migrated.installed.includes(detail.retryLoom));
  assert.deepEqual(detail.launch.input, run.launch.input);
});

test("a candidate write failure affects only its Run and produces no delivery or approval", async () => {
  const state = createSeed(),
    run = state.runs.find((r) => r.stage === "preparing");
  assert.ok(run);
  const dir = await mkdtemp(join(tmpdir(), "intloom-candidate-failure-"));
  try {
    const invalid = join(dir, "occupied");
    await writeFile(invalid, "file");
    const { createCandidateWriter } = await import("../src/main/artifacts.ts");
    let changed = 0;
    await createCandidateWriter(invalid, () => {
      changed++;
    })(state.runs);
    assert.equal(changed, 1);
    assert.equal(run.summary.status, "failed");
    assert.equal(run.summary.error?.code, "ARTIFACT_UNAVAILABLE");
    assert.equal(run.delivered, false);
    assert.ok(
      !run.events.some(
        (e) => e.type === "artifact.created" || e.type === "outcome.delivered",
      ),
    );
    assert.ok(overview(state).runs.some((r) => r.summary.id === "R-1048"));
    assert.ok(getRun(state, run.summary.id)?.artifactIssue);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Studio recognizes the meeting source contract and preserves other complex JSON forms", async () => {
  const { commands } = parse(
    await readFile(
      new URL("../../../examples/meeting-notes/loom.yaml", import.meta.url),
      "utf8",
    ),
  );
  const pkg = {
    ref: { id: "example" },
    manifest: {},
    commands,
    defaultCommand: "summarize",
  } as InstalledLoom;
  assert.equal(packageInfo("example", pkg).commands[0].textOrFile, true);
  delete commands.summarize.input.maxProperties;
  assert.ok(packageInfo("example", pkg).commands[0].jsonSchema);
  commands.summarize.input.maxProperties = 1;
  commands.summarize.input.properties.files.items.properties.kind.const =
    "archive";
  assert.ok(packageInfo("example", pkg).commands[0].jsonSchema);
});

test("Studio surfaces the recorded business failure in the run status", () => {
  const run = {
    loom: { id: "meeting-notes" },
    status: "failed",
    error: {
      businessCode: "NOT_MEETING_CONTENT",
      message: "The component reported a business failure.",
    },
  } as RunSummary;
  assert.match(row(run).message, /NOT_MEETING_CONTENT/);
});
