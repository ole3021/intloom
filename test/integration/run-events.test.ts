import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test, type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import { compileLoom } from "../../packages/compiler/dist/index.js";
import { serve, type Kernel } from "../../packages/kernel/dist/index.js";
import type {
  RunEvent,
  RunEventsCommitted,
} from "../../packages/loom-sdk/dist/index.js";
import { writeFixturePackage } from "./fixture-package.ts";
import { openService } from "../../apps/cli/dist/service/server.js";
import { requestService } from "../../apps/cli/dist/service/client.js";
import { openRunRepository } from "../../packages/kernel/dist/persistence/runs.js";
import { projectRunActivity } from "../../packages/kernel/dist/query/activity.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { createClient } = createRequire(
  new URL("../../packages/kernel/package.json", import.meta.url),
)(
  "@libsql/client",
) as typeof import("../../packages/kernel/node_modules/@libsql/client/lib-esm/node.js");
const imports = `import {defineLoom,defineCode,defineTool,defineStep,defineWorkflow,ApprovalAnswerSchema} from "@intloom/loom-sdk"; import {z} from "zod";`;
async function fixture(t: TestContext, source: string) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-events-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const author = join(directory, "author");
  await mkdir(author);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(author, "node_modules"),
  );
  await writeFile(join(author, "loom.ts"), imports + source);
  await writeFixturePackage(join(author, "loom.ts"));
  const compiled = await compileLoom({
    entryFile: join(author, "loom.ts"),
    outDir: join(directory, "compiled"),
    target: "node22",
  });
  assert.ok(compiled.ok, JSON.stringify(compiled));
  return {
    directory,
    source: compiled.artifactDir,
    dataDir: join(directory, "data"),
  };
}
async function stable(host: Kernel, id: string) {
  for (let i = 0; i < 400; i++) {
    const run = await host.getRun(id);
    if (!["created", "running", "stopping"].includes(run.status)) return run;
    await delay(10);
  }
  throw new Error("Run did not reach a stable boundary");
}
async function history(host: Kernel, runId: string) {
  const events: RunEvent[] = [];
  let after = 0;
  while (true) {
    const page = await host.listRunEvents({ runId, after, limit: 7 });
    events.push(...page.items);
    if (page.nextAfter === undefined) return events;
    after = page.nextAfter;
  }
}

test("Run events commit before notification, project Code/tool/artifact activity and survive reopening", async (t) => {
  const f = await fixture(
    t,
    `
    const tool=defineTool({id:"double",description:"Double",inputSchema:z.number(),outputSchema:z.number(),execute:async({inputData})=>{await new Promise(r=>setTimeout(r,30));return inputData*2;}});
    export default defineLoom({id:"observed-code",version:"1.0.0",description:"Evidence",entry:defineCode({id:"main",inputSchema:z.number(),outputSchema:z.number(),uses:{tools:[tool]},execute:async({inputData,context})=>{
      await context.artifacts.write({name:"evidence.txt",mediaType:"text/plain",data:"safe evidence"});
      context.logger.info("working");return await context.tools.call(tool,inputData);
    }})});`,
  );
  const notices: RunEventsCommitted[] = [];
  const readbacks: Promise<void>[] = [];
  let host: Kernel;
  host = await serve({
    dataDir: f.dataDir,
    onRunEvents: (notice) => {
      notices.push(notice);
      readbacks.push(
        host.getRunActivity(notice.runId).then((activity) => {
          assert.ok(activity.throughSeq >= notice.throughSeq);
          if (activity.run.status === "succeeded")
            assert.equal(activity.validation?.status, "passed");
        }),
      );
      if (notice.throughSeq === 2) throw new Error("isolated observer failure");
    },
  });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: f.source });
  const run = await host.createRun({ loom, input: 21 });
  const before = await host.getRunActivity(run.id);
  assert.equal(before.throughSeq, 1);
  const started = host.listRunEvents({
    runId: run.id,
    after: 1,
    waitMs: 10_000,
  });
  await host.startRun(run.id);
  assert.ok(
    (await started).items.some((event) => event.type === "run.started"),
  );
  assert.equal((await stable(host, run.id)).output, 42);
  const events = await history(host, run.id);
  assert.ok(
    events.every(
      (event, i) => event.schemaVersion === 1 && event.seq === i + 1,
    ),
  );
  assert.deepEqual(
    notices.map((notice) => notice.throughSeq),
    [...new Set(notices.map((notice) => notice.throughSeq))].sort(
      (a, b) => a - b,
    ),
  );
  assert.equal(notices.at(-1)?.throughSeq, events.at(-1)?.seq);
  const code = events.find((event) => event.type === "code.started");
  assert.ok(code);
  const tool = events.find((event) => event.type === "tool.started");
  assert.ok(tool);
  assert.equal(tool.parentExecutionId, code.executionId);
  assert.equal(
    events.find((event) => event.type === "artifact.created")?.executionId,
    code.executionId,
  );
  assert.equal(
    events.find((event) => event.type === "log")?.executionId,
    code.executionId,
  );
  assert.ok(events.find((event) => event.type === "run.started")?.operationId);
  const activity = await host.getRunActivity(run.id);
  assert.equal(activity.coverage, "complete");
  assert.equal(activity.steps.length, 0);
  assert.equal(activity.artifacts.length, 1);
  assert.equal(activity.validation?.status, "passed");
  assert.equal(activity.activeExecutions.length, 0);
  assert.equal(activity.usage.complete, true);
  assert.equal(activity.usage.calls, 0);
  assert.deepEqual(
    activity.recentExecutions.map((call) => [call.kind, call.status]),
    [
      ["tool", "succeeded"],
      ["code", "succeeded"],
    ],
  );
  assert.equal(activity.finishedExecutionCount, 2);
  const { output: _output, ...result } = await host.getRunResult(run.id);
  assert.deepEqual(activity.result, result);
  assert.ok(!("output" in activity.run));
  assert.equal(
    (
      await host.listRunEvents({
        runId: run.id,
        after: activity.throughSeq,
        waitMs: 5,
      })
    ).items.length,
    0,
  );
  await Promise.all(readbacks);
  await host.close();
  host = await serve({ dataDir: f.dataDir });
  assert.deepEqual(await host.getRunActivity(run.id), activity);
});

test("Run events distinguish nested foreach instances and retain their identity across saved waits and resumes", async (t) => {
  const f = await fixture(
    t,
    `
    const ask=defineStep({id:"ask",inputSchema:z.number(),outputSchema:z.number(),suspendSchema:z.number(),resumeSchema:z.number(),interaction:{message:()=>"Answer"},execute:async({inputData,resumeData,suspend})=>resumeData===undefined?suspend(inputData):resumeData});
    const inner=defineWorkflow({id:"inner",description:"Review nested items",inputSchema:z.number(),outputSchema:z.number()}).then(ask).commit();
    const entry=defineWorkflow({id:"outer",inputSchema:z.array(z.number()),outputSchema:z.array(z.number())}).foreach(defineStep(inner,{id:"items"}),{concurrency:2}).commit();
    export default defineLoom({id:"observed-waits",version:"1.0.0",description:"Evidence",entry});`,
  );
  let host = await serve({ dataDir: f.dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: f.source });
  const run = await host.createRun({ loom, input: [1, 2] });
  await host.startRun(run.id);
  assert.equal((await stable(host, run.id)).status, "waiting");
  let activity = await host.getRunActivity(run.id);
  assert.equal(activity.progress.total, undefined);
  assert.equal(activity.coverage, "complete");
  const questions = activity.interactions;
  assert.equal(questions.length, 2);
  assert.equal(
    new Set(questions.map((question) => question.executionId)).size,
    2,
  );
  const oldEvents = await history(host, run.id);
  assert.equal(
    oldEvents.filter((event) => event.type === "step.started").length,
    4,
  );
  const oldStarts = new Set(
    oldEvents
      .filter((event) => event.type.endsWith(".started"))
      .map((event) => event.executionId),
  );
  await host.close();
  host = await serve({ dataDir: f.dataDir });
  for (const [index, question] of questions.entries()) {
    await host.respondInteraction(
      question.id,
      { action: "submit", value: index + 10 },
      { source: { kind: "test", via: "api" } },
    );
    await stable(host, run.id);
  }
  activity = await host.getRunActivity(run.id);
  assert.equal(activity.run.status, "succeeded", JSON.stringify(activity));
  assert.equal(activity.coverage, "complete", JSON.stringify(activity));
  assert.ok(
    activity.steps.some((step) => step.label === "Review nested items"),
  );
  assert.equal(activity.activeExecutions.length, 0);
  const events = await history(host, run.id);
  assert.equal(
    events.filter((event) => event.type === "step.started").length,
    4,
  );
  for (const event of events.filter(
    (event) =>
      event.type === "step.resumed" || event.type === "workflow.resumed",
  ))
    assert.ok(oldStarts.has(event.executionId), JSON.stringify(event));
  assert.equal(
    events.filter((event) => event.type === "interaction.requested").length,
    2,
  );
  const asked = activity.steps.find(
    (step) => step.path.join("/") === "items/ask",
  );
  assert.ok(asked);
  assert.equal(asked.counts.succeeded, 2);
});

test("Approval is explicit, uses the fixed answer schema and cannot be answered by automated sources", async (t) => {
  const f = await fixture(
    t,
    `
    const review=defineStep({id:"approve",inputSchema:z.string(),outputSchema:z.boolean(),suspendSchema:z.string(),resumeSchema:ApprovalAnswerSchema,interaction:{kind:"approval",message:()=>"Approve this test report?",context:({suspendData})=>({report:suspendData})},execute:async({inputData,resumeData,suspend})=>resumeData===undefined?suspend(inputData):resumeData.approved});
    export default defineLoom({id:"observed-approval",version:"1.0.0",description:"Evidence",entry:defineWorkflow({id:"review",inputSchema:z.string(),outputSchema:z.boolean()}).then(review).commit()});`,
  );
  const host = await serve({ dataDir: f.dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: f.source });
  const run = await host.createRun({ loom, input: "test report" });
  await host.startRun(run.id);
  await stable(host, run.id);
  const question = (await host.listInteractions({ runId: run.id }))[0];
  assert.ok(question);
  assert.equal(question.kind, "approval");
  assert.equal(question.responsePolicy, "human");
  assert.deepEqual(question.answerSchema.required, ["approved"]);
  for (const kind of ["agent", "program", "test", "unknown"] as const)
    await assert.rejects(
      host.respondInteraction(
        question.id,
        { action: "submit", value: { approved: false } },
        { source: { kind, via: "api" } },
      ),
      { code: "RESPONSE_SOURCE_NOT_ALLOWED" },
    );
  const dismissed = await host.respondInteraction(
    question.id,
    { action: "dismiss" },
    { source: { kind: "test", via: "api" } },
  );
  assert.equal(dismissed.requestStatus, "pending");
  await host.cancelRun(run.id);
  assert.equal((await stable(host, run.id)).status, "cancelled");
  const activity = await host.getRunActivity(run.id);
  assert.equal(activity.coverage, "complete");
  assert.ok(activity.steps.some((step) => step.counts.cancelled > 0));
  assert.ok(
    (await history(host, run.id)).some(
      (event) => event.type === "interaction.closed",
    ),
  );
});

test("Event waits use the existing IPC, do not block execution and can be closed independently", async (t) => {
  const f = await fixture(
    t,
    `export default defineLoom({id:"observed-ipc",version:"1.0.0",description:"Evidence",entry:defineCode({id:"main",inputSchema:z.number(),outputSchema:z.number(),execute:({inputData})=>inputData})});`,
  );
  const service = await openService({ dataDir: f.dataDir, mcpPort: 0 });
  t.after(() => service.close());
  const loom = await service.kernel.installLoom({ source: f.source });
  const run = await service.kernel.createRun({ loom, input: 1 });
  const waiting = requestService(f.dataDir, "listRunEvents", [
    { runId: run.id, after: 1, waitMs: 10_000 },
  ]);
  await service.kernel.startRun(run.id);
  assert.ok(await waiting);
  await stable(service.kernel, run.id);
  assert.deepEqual(
    await requestService(f.dataDir, "getRunActivity", [run.id]),
    await service.kernel.getRunActivity(run.id),
  );
  const controller = new AbortController();
  const after = (await service.kernel.getRunActivity(run.id)).throughSeq;
  const cancelled = service.kernel.listRunEvents(
    { runId: run.id, after, waitMs: 10_000 },
    controller.signal,
  );
  controller.abort();
  await assert.rejects(cancelled, { code: "OBSERVATION_CLOSED" });
  assert.equal((await service.kernel.getRun(run.id)).status, "succeeded");
  await service.close();
});

test("A missing finish is incomplete and never replays Code", async (t) => {
  const f = await fixture(
    t,
    `export default defineLoom({id:"observed-legacy",version:"1.0.0",description:"Evidence",entry:defineCode({id:"main",inputSchema:z.number(),outputSchema:z.number(),execute:({inputData})=>inputData})});`,
  );
  let host = await serve({ dataDir: f.dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: f.source });
  const run = await host.createRun({ loom, input: 1 });
  await host.startRun(run.id);
  await stable(host, run.id);
  await host.close();
  assert.ok(run.location);
  const db = createClient({
    url: pathToFileURL(join(run.location.dataDir, "kernel.db")).href,
  });
  await db.execute({
    sql: "DELETE FROM run_events WHERE run_id = ? AND type = 'code.finished'",
    args: [run.id],
  });
  db.close();
  host = await serve({ dataDir: f.dataDir });
  const events = await history(host, run.id);
  assert.equal(
    events.find((event) => event.type === "run.started")?.schemaVersion,
    1,
  );
  const activity = await host.getRunActivity(run.id);
  assert.equal(activity.run.status, "succeeded");
  assert.equal(activity.coverage, "partial");
  assert.equal(activity.activeExecutions[0]?.status, "incomplete");
  assert.equal(
    (await history(host, run.id)).filter(
      (event) => event.type === "code.started",
    ).length,
    1,
  );
});

test("Unsupported event storage is refused without deleting or migrating existing records", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "intloom-old-events-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "kernel.db");
  const db = createClient({ url: pathToFileURL(file).href });
  t.after(() => db.close());
  await db.executeMultiple(
    "CREATE TABLE run_events (run_id TEXT, seq INTEGER, time TEXT, type TEXT, origin TEXT, details TEXT); INSERT INTO run_events VALUES ('original',1,'saved','old.event',NULL,NULL)",
  );
  await assert.rejects(openRunRepository(file), {
    code: "STORAGE_INCOMPATIBLE",
  });
  assert.equal(
    (await db.execute("SELECT type FROM run_events")).rows[0]?.type,
    "old.event",
  );
  assert.equal(
    (await db.execute("PRAGMA table_info(run_events)")).rows.length,
    6,
  );
});

for (const rejected of ["code.started", "code.finished"] as const)
  test(`A failed ${rejected} commit never announces success or replays its side effect`, async (t) => {
    const f = await fixture(
      t,
      `export default defineLoom({id:"observed-fault",version:"1.0.0",description:"Evidence",entry:defineCode({id:"main",inputSchema:z.number(),outputSchema:z.number(),execute:async({inputData,context})=>{await context.artifacts.write({name:"effect.txt",mediaType:"text/plain",data:"once"});return inputData;}})});`,
    );
    const notices: RunEventsCommitted[] = [];
    let host = await serve({
      dataDir: f.dataDir,
      onRunEvents: (notice) => notices.push(notice),
    });
    t.after(() => host.close().catch(() => undefined));
    const loom = await host.installLoom({ source: f.source });
    const run = await host.createRun({ loom, input: 1 });
    assert.ok(run.location);
    const db = createClient({
      url: pathToFileURL(join(run.location.dataDir, "kernel.db")).href,
    });
    await db.execute(
      `CREATE TRIGGER reject_event BEFORE INSERT ON run_events WHEN NEW.type='${rejected}' BEGIN SELECT RAISE(ABORT,'event refused'); END`,
    );
    await host.startRun(run.id);
    let fault = false;
    for (let i = 0; i < 100; i++) {
      try {
        await host.getRun(run.id);
      } catch (error) {
        assert.equal((error as { code: string }).code, "STORAGE_UNAVAILABLE");
        fault = true;
        break;
      }
      await delay(5);
    }
    assert.ok(fault);
    assert.equal((await host.getStorageIssues()).length, 1);
    await host.close();
    await db.execute("DROP TRIGGER reject_event");
    db.close();
    host = await serve({ dataDir: f.dataDir });
    assert.equal((await host.getRun(run.id)).status, "interrupted");
    const events = await history(host, run.id);
    assert.ok(!events.some((event) => event.type === rejected));
    assert.ok(!events.some((event) => event.type === "run.succeeded"));
    assert.equal(
      (await host.listArtifacts({ runId: run.id })).items.length,
      rejected === "code.started" ? 0 : 1,
    );
  });

test("Projection counts each model receipt once, keeps currencies separate and distinguishes absent usage from zero", async (t) => {
  const f = await fixture(
    t,
    `export default defineLoom({id:"observed-usage",version:"1.0.0",description:"Evidence",entry:defineCode({id:"main",inputSchema:z.number(),outputSchema:z.number(),execute:({inputData})=>inputData})});`,
  );
  const host = await serve({ dataDir: f.dataDir });
  const loom = await host.installLoom({ source: f.source });
  const run = await host.createRun({ loom, input: 1 });
  await host.startRun(run.id);
  await stable(host, run.id);
  const manifest = (await host.getLoom(loom)).manifest;
  await host.close();
  assert.ok(run.location);
  const repository = await openRunRepository(
    join(run.location.dataDir, "kernel.db"),
  );
  t.after(() => repository.close());
  const snapshot = await repository.snapshot(run.id);
  assert.ok(snapshot);
  const base = {
    schemaVersion: 1 as const,
    runId: run.id,
    time: run.createdAt,
    executionId: "model",
    origin: { componentId: "fixture" },
  };
  const inputs: import("../../packages/loom-sdk/dist/index.js").RunEventInput[] =
    [
      {
        ...base,
        type: "model.invocation.started",
        details: {
          invocationId: "model",
          slot: "fixture",
          provider: "fixture",
          model: "fixture",
        },
      },
      {
        ...base,
        type: "model.step.finished",
        details: {
          invocationId: "model",
          step: 1,
          inputTokens: 0,
          outputTokens: 0,
          reportedCost: 0,
          currency: "USD",
        },
      },
      {
        ...base,
        type: "model.step.finished",
        details: {
          invocationId: "model",
          step: 1,
          inputTokens: 0,
          outputTokens: 0,
          reportedCost: 0,
          currency: "USD",
        },
      },
      {
        ...base,
        type: "model.step.finished",
        details: {
          invocationId: "model",
          step: 2,
          inputTokens: 10,
          reportedCost: 1,
          currency: "CNY",
        },
      },
      {
        ...base,
        type: "model.step.finished",
        details: { invocationId: "model", step: 3, reportedCost: 2 },
      },
      {
        ...base,
        type: "model.invocation.finished",
        details: {
          invocationId: "model",
          status: "failed",
          stepCount: 3,
          durationMs: 1,
        },
      },
    ];
  const activity = projectRunActivity(
    {
      ...snapshot,
      events: [
        ...snapshot.events,
        ...inputs.map(
          (event, index): RunEvent => ({
            ...base,
            ...event,
            seq: snapshot.events.length + index + 1,
          }),
        ),
      ],
    },
    manifest,
  );
  assert.equal(activity.usage.observedSteps, 3);
  assert.deepEqual(activity.usage.inputTokens, { reported: 10, receipts: 2 });
  assert.deepEqual(activity.usage.outputTokens, { reported: 0, receipts: 1 });
  assert.deepEqual(activity.usage.costs, {
    USD: { reported: 0, receipts: 1 },
    CNY: { reported: 1, receipts: 1 },
  });
  assert.equal(activity.usage.costsWithoutCurrency, 1);
  assert.equal(activity.usage.complete, false);
  assert.deepEqual(
    activity.recentExecutions.find((call) => call.kind === "model")?.usage,
    activity.usage,
  );

  const calls = Array.from({ length: 25 }, (_, index) => ({
    ...base,
    executionId: `tool-${index}`,
    origin: { componentId: `tool-${index}` },
  }));
  const events: RunEvent[] = [...snapshot.events];
  for (const call of calls)
    events.push({ ...call, type: "tool.started", seq: events.length + 1 });
  for (const call of calls.slice(1).reverse())
    events.push({
      ...call,
      type: "tool.finished",
      details: { status: "succeeded", durationMs: 1 },
      seq: events.length + 1,
    });
  const bounded = projectRunActivity(
    {
      ...snapshot,
      record: {
        ...snapshot.record,
        view: { ...snapshot.record.view, status: "running" },
      },
      events,
    },
    manifest,
  );
  assert.equal(bounded.finishedExecutionCount, 25);
  assert.equal(bounded.recentExecutions.length, 20);
  assert.equal(bounded.recentExecutions[0]?.id, "tool-20");
  assert.equal(bounded.recentExecutions.at(-1)?.id, "tool-1");
  assert.equal(bounded.activeExecutions[0]?.id, "tool-0");
});

test("Tool summaries are bounded persisted display data and cannot change the business output", async (t) => {
  const f = await fixture(
    t,
    `
    const output=z.object({mode:z.string(),matches:z.number(),privateValue:z.string()});
    const tool=defineTool({id:"search",description:"Search",inputSchema:z.string(),outputSchema:output,
      execute:({inputData})=>{if(inputData==="failed")throw new Error("Tool execution failed");return {mode:inputData,matches:12,privateValue:"not-for-events"};},
      summarize:(value)=>{
        if(value.mode==="throw")throw new Error("not-for-events");
        if(value.mode==="invalid-summary")return 123 as any;
        if(value.mode==="empty")return undefined;
        const matches=value.matches;value.matches=999;
        return matches+" matches"+(value.mode==="long"?"\\n\\x1b[31m token=fixture-secret "+"检查".repeat(200):"");
      }});
    export default defineLoom({id:"tool-summary",version:"1.0.0",description:"Summary boundary",entry:defineCode({id:"main",inputSchema:z.string(),outputSchema:output,uses:{tools:[tool]},execute:({inputData,context})=>context.tools.call(tool,inputData)})});
  `,
  );
  let host = await serve({ dataDir: f.dataDir });
  t.after(() => host.close());
  const loom = await host.installLoom({ source: f.source });
  for (const mode of [
    "normal",
    "long",
    "empty",
    "throw",
    "invalid-summary",
    "failed",
  ]) {
    const run = await host.createRun({ loom, input: mode });
    await host.startRun(run.id);
    const settled = await stable(host, run.id);
    const events = await history(host, run.id);
    const ended = events.find((e) => e.type === "tool.finished");
    assert.ok(ended?.type === "tool.finished");
    const summary = ended.details.summary;
    if (mode === "failed") {
      assert.equal(settled.status, "failed");
      assert.equal(settled.error?.code, "EXECUTION_FAILED");
      assert.equal(summary, undefined);
    } else {
      assert.equal(settled.status, "succeeded");
      assert.equal((settled.output as { matches: number }).matches, 12);
      if (mode === "normal") assert.equal(summary, "12 matches");
      else if (mode === "long") {
        assert.ok(summary);
        assert.ok(summary.startsWith("12 matches token=[redacted]"));
        assert.equal([...summary].length, 200);
        assert.ok(summary.endsWith("…"));
        assert.doesNotMatch(summary, /\p{Cc}|fixture-secret/u);
      } else assert.equal(summary, undefined);
    }
    const warnings = events.filter(
      (e) =>
        e.type === "log" &&
        e.details.message === "Tool result summary unavailable.",
    );
    assert.equal(
      warnings.length,
      ["throw", "invalid-summary"].includes(mode) ? 1 : 0,
    );
    assert.doesNotMatch(
      JSON.stringify(events),
      /not-for-events|fixture-secret/,
    );
    const activity = await host.getRunActivity(run.id);
    assert.equal(
      activity.recentExecutions.find((e) => e.kind === "tool")?.summary,
      summary,
    );
    await host.close();
    host = await serve({ dataDir: f.dataDir });
    assert.deepEqual(await host.getRunActivity(run.id), activity);
  }
});
