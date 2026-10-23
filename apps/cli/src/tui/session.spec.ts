import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import type {
  CliCore,
  CoreResult,
  ProjectEvent,
  ServiceRunView,
} from "../core/index.ts";
import { createTuiSession } from "./session.ts";

type Status = Awaited<ReturnType<CliCore["getServiceStatus"]>>;
type SessionCore = Pick<
  CliCore,
  "getServiceStatus" | "startService" | "watchProject"
>;
const projectRoot = "/fixture";
const instanceId = randomUUID();
const meta = { requestId: randomUUID() };
const service = {
  version: 1 as const,
  apiVersion: 1 as const,
  capabilities: [],
  projectRoot,
  pid: 1,
  instanceId,
  url: "http://127.0.0.1:1/mcp",
  storage: "file" as const,
  startedAt: new Date().toISOString(),
  loomCount: 0,
  availableLoomCount: 0,
  runningRuns: 0,
  waitingRuns: 0,
  completedRuns: 0,
  failedRuns: 0,
};
const running: Status = {
  ok: true,
  data: { status: "running", projectRoot, service },
  meta,
};
const stopped: Status = {
  ok: true,
  data: { status: "stopped", projectRoot },
  meta,
};
const failed = (code: string): CoreResult<never> => ({
  ok: false,
  error: { code, message: "fixture diagnostic", retryable: false },
  outcome: "not_applied",
  meta,
});
const snapshot = (): CoreResult<ProjectEvent> => ({
  ok: true,
  data: {
    type: "project_snapshot",
    serviceInstanceId: instanceId,
    service,
    looms: [],
    runs: [],
  },
  meta,
});

function fake(getStatus: () => Promise<Status>) {
  let starts = 0,
    observers = 0,
    aborted = 0;
  const core: SessionCore = {
    getServiceStatus: getStatus,
    startService: async () => {
      starts++;
      return failed("CONFIG_INVALID");
    },
    async *watchProject(_input, options = {}) {
      observers++;
      yield snapshot();
      await new Promise<void>((resolve) => {
        const stop = () => {
          aborted++;
          resolve();
        };
        if (options.signal?.aborted) stop();
        else options.signal?.addEventListener("abort", stop, { once: true });
      });
      // Deliberately late event: a replaced/disposed subscription must ignore it.
      yield snapshot();
    },
  };
  return { core, counts: () => ({ starts, observers, aborted }) };
}

test("auto-start only follows a verified stopped project; invalid/unavailable/running never starts", async () => {
  const unavailable: Status = {
    ok: true,
    data: {
      status: "unavailable",
      projectRoot,
      diagnostic: {
        code: "CLI_SERVICE_UNAVAILABLE",
        message: "stale lock",
        retryable: false,
      },
    },
    meta,
  };
  for (const status of [failed("CLI_PROJECT_INVALID"), unavailable, running]) {
    const fixture = fake(async () => status);
    const session = createTuiSession(fixture.core, projectRoot, () => {});
    await session.refresh({ startIfStopped: true });
    await delay(0);
    assert.equal(fixture.counts().starts, 0);
    if (status === running) assert.equal(session.snapshot.ready, true);
    session.dispose();
  }
  const fixture = fake(async () => stopped);
  const session = createTuiSession(fixture.core, projectRoot, () => {});
  await session.refresh({ startIfStopped: true });
  assert.equal(fixture.counts().starts, 1);
  assert.match(session.snapshot.message, /CONFIG_INVALID/);
  await session.refresh();
  assert.equal(fixture.counts().starts, 1, "refresh does not replay startup");
  session.dispose();
});

test("refresh replaces subscriptions, ignores late events and rejects stale Run revisions/instances", async () => {
  const fixture = fake(async () => running);
  let publications = 0;
  const session = createTuiSession(fixture.core, projectRoot, () => {
    publications++;
  });
  await session.refresh();
  await delay(0);
  const run: ServiceRunView = {
    serviceInstanceId: instanceId,
    revision: 2,
    runId: "RUN-fixture",
    loomName: "fixture",
    execution: { source: "cli", agentExecutor: "service" },
    cursor: { stageName: "first", stepName: "one" },
    status: "waiting",
    createdAt: service.startedAt,
    updatedAt: service.startedAt,
  };
  session.observeRun(run);
  session.observeRun({ ...run, revision: 1, status: "running" });
  session.observeRun({ ...run, serviceInstanceId: randomUUID(), revision: 9 });
  assert.equal(session.snapshot.runs[0]?.revision, 2);
  await session.refresh();
  await delay(0);
  assert.equal(session.snapshot.runs[0]?.revision, 2);
  assert.deepEqual(fixture.counts(), { starts: 0, observers: 2, aborted: 1 });
  session.dispose();
  const before = publications;
  await delay(0);
  assert.equal(publications, before);
  assert.equal(fixture.counts().aborted, 2);
});

test("closing during discovery prevents late automatic startup or observer attachment", async () => {
  let complete!: (result: Status) => void;
  const fixture = fake(
    () =>
      new Promise<Status>((resolve) => {
        complete = resolve;
      }),
  );
  const session = createTuiSession(fixture.core, projectRoot, () => {});
  const loading = session.refresh({ startIfStopped: true });
  session.dispose();
  complete(stopped);
  await loading;
  assert.deepEqual(fixture.counts(), { starts: 0, observers: 0, aborted: 0 });
});
