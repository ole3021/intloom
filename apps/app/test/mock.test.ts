import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { MockService, createSeed, recoverOnOpen } from "../src/mock/service.ts";
import {
  isActive,
  pending,
  statusText,
  descendants,
} from "../src/mock/run-state.ts";
import { getRunActivity } from "../src/mock/activity.ts";
import { candidateReady } from "../src/mock/lifecycle.ts";
import { registerArtifact, copyArtifact } from "../src/main/artifacts.ts";
import type { Launch } from "../src/shared/types.ts";
function setup() {
  let clock = Date.parse("2026-11-10T02:00:00Z");
  const s = new MockService(createSeed(clock), () => clock);
  for (const r of s.state.runs)
    candidateReady(r, new Date(clock).toISOString());
  return {
    s,
    next() {
      clock += 3000;
      s.tick();
    },
  };
}
const draft: Launch = {
  loom: "demo-presentation",
  command: "create",
  projectDir: "/Demo/春季发布",
  profileId: "daily",
  input: { title: "验证文稿", files: ["fixture.md"], pages: 3, outline: true },
  finalConfirmation: true,
};
test("invalid command input never creates a Run; effective bindings are frozen", () => {
  const { s } = setup(),
    n = s.state.runs.length;
  assert.throws(() =>
    s.apply({
      type: "launch",
      draft: { ...draft, input: { title: "", pages: 0, files: [] } },
    }),
  );
  assert.equal(s.state.runs.length, n);
  s.apply({ type: "launch", draft });
  const r = s.state.runs[0];
  assert.equal(r.binding.source, "本次临时指定");
  const settings = structuredClone(s.state.settings);
  settings.profiles[0].name = "New";
  settings.models[1].model = "updated";
  s.apply({
    type: "saveResource",
    resource: { kind: "profiles", value: settings.profiles[0] },
  });
  s.apply({
    type: "saveResource",
    resource: { kind: "models", value: settings.models[1] },
  });
  assert.equal(r.binding.profile, "日常");
  assert.equal(r.binding.planner.model, "gpt-4.1");
});
test("outline then fixed candidate approval, actual usage, PPTX and no-clobber export", async () => {
  const { s, next } = setup();
  s.apply({ type: "launch", draft });
  const r = s.state.runs[0];
  next();
  next();
  assert.equal(r.stage, "outline");
  const answer = (v: boolean) =>
    s.apply({
      type: "answer",
      requestId: pending(r)[0].id,
      value: v,
    });
  answer(true);
  next();
  next();
  assert.equal(r.stage, "preparing");
  assert.equal(r.delivered, false);
  const folder = await mkdtemp(join(tmpdir(), "intloom-studio-artifacts-"));
  try {
    r.artifact = await registerArtifact(folder, r);
    candidateReady(r, r.summary.updatedAt);
    assert.equal(r.stage, "final");
    const path = await copyArtifact(folder, r.artifact);
    const bytes = await readFile(path);
    const entries = unzipSync(bytes);
    assert.match(strFromU8(entries["ppt/slides/slide1.xml"]), /验证文稿/);
    assert.equal(
      Object.keys(entries).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
        .length,
      3,
    );
    answer(true);
    next();
    assert.equal(r.summary.status, "succeeded");
    assert.equal(r.delivered, true);
    assert.deepEqual(
      await readFile(await copyArtifact(folder, r.artifact, folder)),
      bytes,
    );
    await assert.rejects(copyArtifact(folder, r.artifact, folder));
    assert.equal(getRunActivity(r).usage.calls, 2);
  } finally {
    await rm(folder, { recursive: true });
  }
});
test("final rejection preserves fixed candidate and never marks it delivered", () => {
  const { s, next } = setup();
  s.apply({
    type: "launch",
    draft: { ...draft, input: { ...draft.input, outline: false } },
  });
  const r = s.state.runs[0];
  for (let i = 0; i < 4; i++) next();
  candidateReady(r, r.summary.updatedAt);
  const q = pending(r)[0];
  s.apply({ type: "answer", requestId: q.id, value: false });
  assert.equal(r.rejected, true);
  assert.ok(r.candidate);
  assert.equal(r.delivered, false);
  assert.throws(() =>
    s.apply({ type: "answer", requestId: q.id, value: true }),
  );
});
test("cancel scopes to descendants, lost acknowledgement remains unconfirmed until retry", () => {
  const { s, next } = setup();
  s.apply({ type: "cancel", id: "R-1047", simulateLost: true });
  const photo = s.state.runs.find((r) => r.summary.id === "R-1047");
  assert.ok(photo);
  next();
  assert.equal(statusText(photo), "无法确认是否已停止");
  assert.ok(
    descendants(s.state, photo.summary.id).every(
      (r) => r.summary.status === "cancelled",
    ),
  );
  assert.equal(
    s.state.runs.find((r) => r.summary.id === "R-1048")?.summary.status,
    "waiting",
  );
  s.apply({ type: "verifyStop", id: photo.summary.id });
  next();
  assert.equal(photo.summary.status, "cancelled");
});
test("shutdown waits for all live receipts, retains history offline", () => {
  const { s, next } = setup();
  s.apply({ type: "service", online: false, simulateLost: true });
  next();
  assert.equal(s.state.service, "stopping");
  s.apply({ type: "verifyStop" });
  next();
  next();
  assert.equal(s.state.service, "offline");
  assert.equal(s.state.runs.filter(isActive).length, 0);
  assert.throws(() => s.apply({ type: "launch", draft }));
  assert.ok(s.state.runs.find((r) => r.delivered)?.candidate);
});
test("original input reuse and safe recovery require original installed package", () => {
  const { s } = setup();
  assert.throws(() =>
    s.apply({ type: "resume", id: "R-1043", waitId: "missing" }),
  );
  s.apply({ type: "catalog", id: "report-writer", install: false });
  assert.throws(() =>
    s.apply({ type: "resume", id: "R-1044", waitId: "R-1044-proof" }),
  );
  s.apply({ type: "catalog", id: "report-writer", install: true });
  assert.equal(
    s.apply({ type: "resume", id: "R-1044", waitId: "R-1044-proof" }).receipt
      ?.run.id,
    "R-1044",
  );
  recoverOnOpen(s.state);
  assert.equal(
    s.state.runs.find((r) => r.summary.id === "R-1044")?.summary.status,
    "interrupted",
  );
  assert.equal(
    s.state.runs.find((r) => r.summary.id === "R-1048")?.summary.status,
    "waiting",
  );
});
test("startup failure belongs to the accepted Run; fixing a binding and retrying creates a new Run", () => {
  const { s, next } = setup();
  const settings = structuredClone(s.state.settings);
  settings.harnesses[0].availability = "missing";
  s.apply({
    type: "saveResource",
    resource: { kind: "harnesses", value: settings.harnesses[0] },
  });
  const first = s.apply({ type: "launch", draft }).receipt;
  assert.ok(first);
  next();
  assert.equal(s.state.runs[0].summary.error?.code, "HARNESS_UNAVAILABLE");
  settings.harnesses[0].availability = "ready";
  s.apply({
    type: "saveResource",
    resource: { kind: "harnesses", value: settings.harnesses[0] },
  });
  const second = s.apply({ type: "launch", draft }).receipt;
  assert.ok(second);
  assert.notEqual(first.run.id, second.run.id);
  next();
  assert.equal(s.state.runs[0].summary.status, "running");
});
test("global, project and one-off choices are independent; parent lookup uses original child request", () => {
  const { s, next } = setup(),
    launch = (projectDir: string, profileId: string) => {
      s.apply({ type: "launch", draft: { ...draft, projectDir, profileId } });
      return s.state.runs[0];
    };
  assert.equal(launch("", "").binding.source, "全局默认");
  assert.equal(launch("/Demo/春季发布", "").binding.profile, "高质量");
  const run = launch("/Demo/春季发布", "daily");
  assert.equal(run.binding.profile, "日常");
  assert.equal(s.state.settings.projects["/Demo/春季发布"], "quality");
  run.summary = { ...run.summary, parentRunId: "R-1047" };
  next();
  next();
  const q = descendants(s.state, "R-1047")
    .flatMap(pending)
    .find((q) => q.runId === run.summary.id);
  assert.ok(q);
  s.apply({ type: "answer", requestId: q.id, value: true });
  assert.equal(run.answers.length, 1);
  assert.ok(
    !descendants(s.state, "R-1047")
      .flatMap(pending)
      .some((x) => x.id === q.id),
  );
});
