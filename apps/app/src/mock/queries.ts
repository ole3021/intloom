import type {
  RunListItem,
  RunDetail,
  RunQuery,
  Snapshot,
} from "../shared/types.ts";
import type { MockRun, MockState } from "./state.ts";
import {
  descendants,
  pending,
  statusText,
  message,
  isActive,
} from "./run-state.ts";
import { getRunActivity } from "./activity.ts";
import {
  catalog,
  sampleProjects,
  sampleFiles,
  launchPackage,
} from "../shared/catalog.ts";

function listItem(run: MockRun): RunListItem {
  return {
    summary: run.summary,
    title: run.title,
    via: run.via,
    statusLabel: statusText(run),
    message: message(run),
    pending: pending(run).map(({ id, kind, createdAt, message }) => ({
      id,
      kind,
      createdAt,
      message,
    })),
  };
}
const recentFirst = (a: MockRun, b: MockRun) =>
  b.summary.updatedAt.localeCompare(a.summary.updatedAt) ||
  b.summary.id.localeCompare(a.summary.id);
export function overview(state: MockState): Snapshot {
  const live = state.runs.filter(
    (run) => isActive(run) || run.summary.status === "interrupted",
  );
  const recent = state.runs
    .filter(
      (run) => !run.summary.parentRunId && run.summary.status === "succeeded",
    )
    .sort(recentFirst)
    .slice(0, 5);
  return {
    catalog,
    mock: { projects: sampleProjects, files: sampleFiles },
    service: state.service,
    installed: state.installed,
    settings: state.settings,
    runs: [...live, ...recent].map(listItem),
  };
}
export function listRuns(
  state: MockState,
  { query = "", status, loom, limit = 30, cursor }: RunQuery,
) {
  const search = query.toLowerCase();
  const rows = state.runs
    .filter(
      (r) =>
        (!status || status === "all" || r.summary.status === status) &&
        (!loom || launchPackage(r.launch) === loom) &&
        [
          r.title,
          r.summary.id,
          r.summary.location.projectDir,
          r.launch.loom,
          r.via,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search),
    )
    .sort(recentFirst);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw Error("每页可读取 1 到 100 条记录。");
  const filterKey = JSON.stringify([search, status ?? "all", loom ?? ""]);
  let remaining = rows;
  if (cursor) {
    const anchor = JSON.parse(cursor);
    if (
      !Array.isArray(anchor) ||
      anchor[0] !== filterKey ||
      typeof anchor[1] !== "string" ||
      typeof anchor[2] !== "string"
    )
      throw Error("游标与查询条件不符。");
    const [, time, id] = anchor;
    remaining = rows.filter(
      (r) =>
        r.summary.updatedAt < time ||
        (r.summary.updatedAt === time && r.summary.id.localeCompare(id) < 0),
    );
  }
  const page = remaining.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(listItem),
    nextCursor:
      remaining.length > page.length && last
        ? JSON.stringify([filterKey, last.summary.updatedAt, last.summary.id])
        : undefined,
  };
}
function durations(run: MockRun): RunDetail["durations"] {
  const start = run.summary.startedAt ?? run.summary.createdAt;
  let since = start,
    workMs = 0,
    waitMs = 0,
    ticking: RunDetail["durations"]["ticking"] = "work";
  for (const e of run.events) {
    let next: RunDetail["durations"]["ticking"];
    if (e.type === "run.waiting") next = "wait";
    else if (["run.resumed", "run.stopping"].includes(e.type)) next = "work";
    else if (
      [
        "run.interrupted",
        "run.cancelled",
        "run.failed",
        "run.succeeded",
      ].includes(e.type)
    )
      next = "stopped";
    else continue;
    const elapsed = Math.max(0, Date.parse(e.time) - Date.parse(since));
    if (ticking === "work") workMs += elapsed;
    if (ticking === "wait") waitMs += elapsed;
    since = e.time;
    ticking = next;
  }
  return { workMs, waitMs, since, ticking };
}
export function getRun(
  state: MockState,
  id: string,
): (RunDetail & Pick<MockRun, "launch" | "binding">) | null {
  const run = state.runs.find((r) => r.summary.id === id);
  if (!run) return null;
  const children = descendants(state, id);
  return {
    ...listItem(run),
    launch: run.launch,
    retryLoom: launchPackage(run.launch),
    binding: run.binding,
    activity: getRunActivity(run),
    events: run.events,
    answers: run.answers,
    candidate: run.candidate,
    files: run.artifact
      ? [{ record: run.artifact, delivered: run.delivered }]
      : [],
    artifactIssue: run.artifactIssue,
    delivered: run.delivered,
    children: children.map(listItem),
    reviews: [run, ...children]
      .filter((r) => ["waiting", "running"].includes(r.summary.status))
      .flatMap((r) =>
        pending(r).map((request) => ({
          request,
          title: r.title,
          candidate:
            request.origin.componentId === "final" ? r.candidate : undefined,
        })),
      ),
    durations: durations(run),
  };
}
