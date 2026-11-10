import type { MockRun, MockState } from "./state.ts";
export { isActive } from "../shared/run-status.ts";
export function descendants(state: MockState, id: string): MockRun[] {
  return state.runs
    .filter((run) => run.summary.parentRunId === id)
    .flatMap((run) => [run, ...descendants(state, run.summary.id)]);
}
export const pending = (run: MockRun) =>
  run.requests.filter((q) => q.status === "pending");
export function statusText(run: MockRun) {
  if (
    run.summary.status === "stopping" &&
    run.summary.recoveryIssue?.code === "STOP_UNCONFIRMED"
  )
    return "无法确认是否已停止";
  if (run.summary.status === "succeeded")
    return run.rejected
      ? run.candidate
        ? "已拒绝交付"
        : "大纲已拒绝"
      : run.delivered
        ? "已交付"
        : "已完成";
  return {
    created: "已创建",
    running: "运行中",
    waiting: pending(run).length ? "等我处理" : "等待中",
    stopping: "已请求取消",
    failed: "失败",
    cancelled: "已取消",
    interrupted: "已中断",
  }[run.summary.status];
}
export function message(run: MockRun) {
  if (run.summary.status === "stopping")
    return (
      run.summary.recoveryIssue?.message || "等待受管工作和子 Run 确认停止。"
    );
  if (run.summary.status === "interrupted" && !run.summary.recoveryIssue)
    return "没有可继续的等待点，可用原输入新建 Run。";
  if (run.summary.status === "waiting" && !pending(run).length)
    return (
      run.summary.recoveryIssue?.message ??
      (run.summary.waits.some((w) => w.kind === "external")
        ? "已到达外部等待点，可继续此 Run。"
        : "回答已保存，等待继续执行。")
    );
  return (
    pending(run)[0]?.message ??
    run.summary.error?.message ??
    run.summary.recoveryIssue?.message ??
    (run.delivered ? run.candidate?.name : undefined) ??
    (run.rejected
      ? "已保存拒绝决定"
      : run.summary.status === "cancelled"
        ? "已确认停止"
        : run.steps[run.position]) ??
    statusText(run)
  );
}
