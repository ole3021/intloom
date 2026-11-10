import { useState } from "react";
import { useClock } from "@/hooks/use-clock";
import {
  Activity,
  ArrowRight,
  CheckCheck,
  ChevronRight,
  Clock3,
  Folder,
  Inbox,
  Plus,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Heading,
  StateBadge,
  when,
  duration,
  Choice,
} from "@/components/common";
import { navigate, useStudio } from "@/lib/studio";
import { useRunList } from "../hooks/use-run-query";
import { fileName, type RunListItem } from "../../shared/types";
export function RunRow({
  run,
  offline = false,
  now = Date.now(),
}: {
  run: RunListItem;
  offline?: boolean;
  now?: number;
}) {
  const isPending =
    run.pending.length > 0 &&
    ["running", "waiting"].includes(run.summary.status);
  return (
    <button
      type="button"
      className="run-row flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/60"
      onClick={() => navigate(`/run/${run.summary.id}`)}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{run.title}</span>
          {run.summary.parentRunId && <Badge variant="outline">子 Run</Badge>}
          <span className="text-xs text-muted-foreground">
            {fileName(run.summary.location.projectDir || "")}
          </span>
        </div>
        <p className="truncate text-sm text-muted-foreground">{run.message}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        <span className="hidden sm:inline">
          {offline
            ? `最后记录 ${when(run.summary.updatedAt)}`
            : run.summary.status === "interrupted"
              ? `中断于 ${when(run.summary.updatedAt)}`
              : isPending
                ? `等待 ${duration(now - Date.parse(run.pending[0].createdAt))}`
                : run.summary.finishedAt
                  ? `${when(run.summary.finishedAt)} 结束`
                  : duration(
                      now -
                        Date.parse(
                          run.summary.startedAt || run.summary.createdAt,
                        ),
                    )}
        </span>
        {isPending ? (
          <span className="font-medium text-amber-800 dark:text-amber-300">
            {run.pending[0].kind === "approval" ? "查看确认" : "回答问题"}
          </span>
        ) : null}
        <ChevronRight size={15} />
      </div>
    </button>
  );
}
export function RunCenter({
  all = false,
  params,
}: {
  all?: boolean;
  params: URLSearchParams;
}) {
  const { state } = useStudio(),
    [query, setQuery] = useState(params.get("q") || ""),
    [filter, setFilter] = useState(params.get("status") || "all");
  const [expandWait, setExpandWait] = useState(false);
  const [cursors, setCursors] = useState<string[]>(() =>
    params.getAll("after"),
  );
  const loom = params.get("loom") || undefined;
  const page = useRunList(
    all ? { query, status: filter, loom, cursor: cursors.at(-1) } : null,
  );
  const rows = state.runs,
    offline = state.service === "offline",
    roots = rows.filter((r) => !r.summary.parentRunId);
  const now = useClock(!offline && !all);
  function update(q: string, s: string, after: string[] = []) {
    setCursors(after);
    setQuery(q);
    setFilter(s);
    const u = new URLSearchParams();
    for (const cursor of after) u.append("after", cursor);
    if (loom) u.set("loom", loom);
    if (q) u.set("q", q);
    if (s !== "all") u.set("status", s);
    history.replaceState(null, "", `#/history${u.size ? `?${u}` : ""}`);
  }
  const section = (
    label: string,
    icon: LucideIcon,
    items: RunListItem[],
    highlight = false,
  ) => {
    const Icon = icon;
    return (
      items.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Icon
              size={16}
              className={highlight ? "text-amber-600" : "text-muted-foreground"}
            />
            {label}
            <Badge variant="secondary">{items.length}</Badge>
          </h2>
          <div
            className={
              "divide-y overflow-hidden rounded-lg border " +
              (highlight
                ? "border-amber-300/50 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20"
                : "bg-card")
            }
          >
            {(highlight && !expandWait ? items.slice(0, 2) : items).map((r) => (
              <RunRow key={r.summary.id} run={r} offline={offline} now={now} />
            ))}
          </div>
          {highlight && items.length > 2 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setExpandWait(!expandWait)}
            >
              {expandWait ? "收起" : `查看其余 ${items.length - 2} 条`}
            </Button>
          )}
        </section>
      )
    );
  };
  const wait = rows
    .filter(
      (r) =>
        ["waiting", "running"].includes(r.summary.status) && r.pending.length,
    )
    .sort((a, b) => a.summary.updatedAt.localeCompare(b.summary.updatedAt));
  const done = roots
    .filter((r) => r.summary.status === "succeeded")
    .sort((a, b) => b.summary.updatedAt.localeCompare(a.summary.updatedAt))
    .slice(0, 5);
  const matches = page?.items ?? [];
  return (
    <>
      <Heading
        title={all ? "全部运行" : "运行中心"}
        description={
          all
            ? "按项目、Loom 或状态查找本机运行记录。"
            : "查看本机任务进展，处理等待回应的请求。"
        }
        actions={
          <div className="flex gap-2">
            {!all && (
              <Button variant="outline" onClick={() => navigate("/history")}>
                <Clock3 />
                全部运行
              </Button>
            )}
            <Button onClick={() => navigate("/looms")}>
              <Plus />
              启动 Loom
            </Button>
          </div>
        }
      />
      {all ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Input
              aria-label="搜索运行"
              className="max-w-sm"
              placeholder={
                state.mock
                  ? "搜索任务、项目、包名或 Run ID"
                  : "按完整 Run ID 查找"
              }
              value={query}
              onChange={(e) => update(e.target.value, filter)}
            />
            <Choice
              label="筛选状态"
              value={filter}
              onChange={(v) => update(query, v)}
              options={[
                ["all", "全部状态"],
                ["running", "运行中"],
                ["waiting", "等待中"],
                ["interrupted", "已中断"],
                ["succeeded", "已完成"],
                ["cancelled", "已取消"],
                ["failed", "失败"],
                ["stopping", "正在停止"],
              ]}
            />
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {["任务", "状态", "最近进展", "来源", "更新"].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((r) => (
                  <TableRow key={r.summary.id}>
                    <TableCell>
                      <Button
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => navigate(`/run/${r.summary.id}`)}
                      >
                        {r.title}
                      </Button>
                      <div className="font-mono text-xs text-muted-foreground">
                        {r.summary.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StateBadge run={r} />
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {r.message}
                    </TableCell>
                    <TableCell>{r.via}</TableCell>
                    <TableCell>{when(r.summary.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(cursors.length > 0 || page?.nextCursor) && (
              <div className="flex gap-2 p-2">
                <Button
                  variant="outline"
                  disabled={!cursors.length}
                  onClick={() => update(query, filter, cursors.slice(0, -1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  disabled={!page?.nextCursor}
                  onClick={() => {
                    if (page?.nextCursor)
                      update(query, filter, [...cursors, page.nextCursor]);
                  }}
                >
                  下一页
                </Button>
              </div>
            )}
            {!page && (
              <p role="status" className="p-4">
                正在读取记录…
              </p>
            )}
            {page && !matches.length && (
              <p className="p-6 text-sm text-muted-foreground">
                没有匹配的运行记录。
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          {section("等我处理", Inbox, wait, true)}
          {section(
            offline ? "最后记录为进行中" : "正在运行",
            Activity,
            roots.filter(
              (r) =>
                ["running", "created", "stopping"].includes(r.summary.status) ||
                (r.summary.status === "waiting" && !r.pending.length),
            ),
          )}
          {section(
            "中断待检查",
            TriangleAlert,
            roots.filter((r) => r.summary.status === "interrupted"),
          )}
          {section("最近完成", CheckCheck, done)}
          {!rows.length && (
            <Empty>
              <EmptyHeader>
                <Folder />
                <EmptyTitle>还没有运行记录</EmptyTitle>
                <EmptyDescription>
                  从 Loom 库选择一个命令，开始第一次运行。
                </EmptyDescription>
              </EmptyHeader>
              <Button onClick={() => navigate("/looms")}>
                打开 Loom 库<ArrowRight />
              </Button>
            </Empty>
          )}
        </>
      )}
    </>
  );
}
