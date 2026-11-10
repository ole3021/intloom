import type { MockRun, MockState } from "./state.ts";
import type { ResponseSource } from "@intloom/loom-sdk";
import { catalog, launchPackage } from "../shared/catalog.ts";
import { descendants, isActive } from "./run-state.ts";
import { updateSettings } from "./settings.ts";
import { respond, continueWait } from "./interactions.ts";
import type { Action, ActionResult } from "../shared/types.ts";
import { makeRun, advance, record } from "./lifecycle.ts";
export { createSeed } from "./fixtures.ts";
export function recoverOnOpen(state: MockState, now = Date.now()) {
  const time = new Date(now).toISOString();
  for (const run of state.runs) {
    if (run.summary.status === "running" && run.summary.waits.length) {
      run.summary = { ...run.summary, status: "waiting" };
      run.nextAt = null;
      record(
        run,
        {
          type: "run.waiting",
          details: { waitIds: run.summary.waits.map((w) => w.waitId) },
        },
        time,
      );
    } else if (
      run.summary.status === "running" ||
      run.summary.status === "created"
    ) {
      run.summary = {
        ...run.summary,
        status: "interrupted",
        finishedAt: time,
        waits: [],
        pendingInteractionIds: [],
        recoveryIssue: {
          code: "EXECUTION_INTERRUPTED",
          message: "执行已中断，可用原输入新建 Run。",
        },
      };
      run.nextAt = null;
      record(run, { type: "run.interrupted" }, time);
    } else if (run.summary.status === "stopping") {
      run.nextAt = null;
      run.summary = {
        ...run.summary,
        recoveryIssue: {
          code: "STOP_UNCONFIRMED",
          message: "应用进程重启，尚未核实停止回执。",
        },
      };
    }
  }
}
export class MockService {
  readonly state: MockState;
  private readonly clock: () => number;
  constructor(state: MockState, clock = Date.now) {
    this.state = state;
    this.clock = clock;
  }
  tick() {
    const now = this.clock(),
      time = new Date(now).toISOString();
    let changed = false;
    // A parent can settle only after its unfinished descendants have settled.
    for (const run of [...this.state.runs].reverse()) {
      if (
        run.nextAt === null ||
        run.nextAt > now ||
        this.state.service === "offline"
      )
        continue;
      if (
        run.position === 3 &&
        run.summary.status === "running" &&
        descendants(this.state, run.summary.id).some(isActive)
      )
        continue;
      if (
        run.summary.status === "stopping" &&
        descendants(this.state, run.summary.id).some(isActive)
      )
        continue;
      advance(run, time);
      changed = true;
    }
    if (this.state.service === "stopping" && !this.state.runs.some(isActive)) {
      this.state.service = "offline";
      changed = true;
    }
    return changed;
  }
  apply(action: Action, actor: ResponseSource["kind"] = "human"): ActionResult {
    const state = this.state,
      now = this.clock(),
      time = new Date(now).toISOString();
    const markLost = (run: MockRun | undefined) => {
      if (!run) return;
      run.nextAt = null;
      run.summary = {
        ...run.summary,
        recoveryIssue: {
          code: "STOP_UNCONFIRMED",
          message: "模拟执行器失联，无法确认是否已停止。",
        },
      };
    };
    const stop = (run: MockRun) => {
      if (!isActive(run) || run.summary.status === "stopping") return;
      run.summary = {
        ...run.summary,
        status: "stopping",
        stopReason: { kind: "cancel" },
      };
      run.nextAt = now + 900;
      record(
        run,
        { type: "run.stopping", details: { reason: "cancel" } },
        time,
      );
    };
    if (action.type === "verifyStop") {
      for (const run of action.id
        ? state.runs
            .filter((x) => x.summary.id === action.id)
            .flatMap((x) => [x, ...descendants(state, x.summary.id)])
        : state.runs) {
        if (
          run.summary.status === "stopping" &&
          run.summary.recoveryIssue?.code === "STOP_UNCONFIRMED"
        ) {
          const { recoveryIssue, ...summary } = run.summary;
          run.summary = summary;
          run.nextAt = now + 600;
          record(run, { type: "run.recovery.changed" }, time);
        }
      }
      return {};
    }
    if (
      action.type === "preferences" ||
      action.type === "projectDefault" ||
      action.type === "saveResource"
    ) {
      state.settings = updateSettings(state.settings, action);
      return {};
    }
    if (action.type === "service") {
      if (action.online) {
        if (state.service === "stopping") throw Error("正在等待停止回执。");
        state.service = "online";
      } else if (state.service === "online") {
        state.service = "stopping";
        state.runs.forEach(stop);
        if (action.simulateLost)
          markLost(state.runs.find((run) => run.summary.status === "stopping"));
        this.tick();
      }
      return {};
    }
    if (action.type === "catalog") {
      if (!catalog.some((p) => p.ref.id === action.id))
        throw Error("示例目录中没有该包。");
      state.installed = state.installed.filter((id) => id !== action.id);
      if (action.install) state.installed.push(action.id);
      return {};
    }
    if (state.service !== "online") throw Error("请先启动 Mock Kernel。");
    if (action.type === "launch") {
      if (!state.installed.includes(action.draft.loom))
        throw Error("该 Loom 尚未安装。");
      const id =
        "R-" +
        (Math.max(
          1053,
          ...state.runs.map((run) => Number(run.summary.id.slice(2))),
        ) +
          1);
      const run = makeRun(action.draft, state.settings, time, id, "App");
      state.runs.unshift(run);
      return {
        receipt: {
          run: run.summary,
          operation: "start",
          disposition: "accepted",
        },
      };
    }
    if (action.type === "answer") {
      return { interaction: respond(state, action, actor, now) };
    }
    const run = state.runs.find((run) => run.summary.id === action.id);
    if (!run) throw Error("找不到 Run。");
    if (action.type === "cancel") {
      const active = isActive(run) && run.summary.status !== "stopping";
      if (active) {
        [run, ...descendants(state, action.id)].forEach(stop);
        if (action.simulateLost) markLost(run);
      }
      return {
        receipt: {
          run: run.summary,
          operation: "cancel",
          disposition: active ? "accepted" : "no_change",
        },
      };
    }
    if (!state.installed.includes(launchPackage(run.launch)))
      throw Error("原包已卸载。");
    continueWait(run, action.waitId, now);
    return {
      receipt: {
        operation: "resume",
        disposition: "accepted",
        run: run.summary,
      },
    };
  }
}
