import type { MockRun, MockState } from "./state.ts";
import {
  catalog,
  defaultSettings,
  sampleFiles,
  sampleProjects,
} from "../shared/catalog.ts";
import type { Launch } from "../shared/types.ts";
import { makeRun, advance, record, requestInteraction } from "./lifecycle.ts";
export function createSeed(now = Date.now()): MockState {
  const state: MockState = {
    schemaVersion: 2,
    service: "online",
    runs: [],
    installed: catalog.map((p) => p.ref.id),
    settings: defaultSettings(),
  };
  function seed(
    id: number,
    title: string,
    packageIndex: number,
    age: number,
    via: MockRun["via"],
    extra: Launch["input"] = {},
  ) {
    const p = catalog[packageIndex],
      cmd = p.defaultCommand,
      timestamp = new Date(now - age * 1000).toISOString();
    const run = makeRun(
      {
        loom: p.ref.id,
        command: cmd,
        projectDir: sampleProjects[packageIndex === 1 ? 1 : 0],
        profileId: "",
        finalConfirmation: false,
        input: {
          title,
          files: sampleFiles[cmd],
          ...(packageIndex === 0 ? { pages: 6, outline: true } : {}),
          ...extra,
        },
      },
      state.settings,
      timestamp,
      `R-${id}`,
      via,
    );
    state.runs.push(run);
    run.nextAt = now + 60000;
    return run;
  }
  const timestamp = new Date(now).toISOString();
  const deck = seed(1048, "春季发布会演示稿", 0, 368, "CLI");
  deck.position = 1;
  advance(deck, new Date(now - 110000).toISOString());
  const askRun = seed(1050, "门店访谈小结", 2, 280, "App", { ask: true });
  askRun.position = 1;
  advance(askRun, new Date(now - 45000).toISOString());
  const parallel = seed(1052, "周会报告 · 两项待办", 2, 180, "App", {
    ask: true,
  });
  parallel.position = 1;
  advance(parallel, timestamp);
  requestInteraction(
    parallel,
    "ask",
    "周会上希望优先讨论哪项进展？",
    timestamp,
  );
  const photo = seed(1047, "春季主视觉调色", 1, 180, "MCP");
  photo.position = 2;
  const child = seed(1053, "门店照片预览", 1, 32, "MCP");
  child.summary = { ...child.summary, parentRunId: photo.summary.id };
  child.nextAt = now + 30000;
  seed(1051, "渠道培训讲义", 0, 35, "App").nextAt = now + 22000;
  const report = seed(1046, "发布筹备周报", 2, 760, "App");
  report.position = 3;
  advance(report, new Date(now - 560000).toISOString());
  const waiting = seed(1044, "夏季目录校样", 2, 890, "CLI");
  waiting.summary = {
    ...waiting.summary,
    status: "waiting",
    waits: [
      {
        kind: "external",
        waitId: "R-1044-proof",
        origin: { componentId: "proof" },
      },
    ],
  };
  waiting.nextAt = null;
  record(
    waiting,
    { type: "run.waiting", details: { waitIds: ["R-1044-proof"] } },
    timestamp,
  );
  const interrupted = seed(1043, "官网素材整理", 2, 890, "CLI");
  interrupted.summary = {
    ...interrupted.summary,
    status: "interrupted",
    finishedAt: timestamp,
    recoveryIssue: {
      code: "EXECUTION_INTERRUPTED",
      message: "原执行没有可继续的等待点。",
    },
  };
  interrupted.nextAt = null;
  record(interrupted, { type: "run.interrupted" }, timestamp);
  return state;
}
