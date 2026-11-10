import { useState } from "react";
import { useClock } from "@/hooks/use-clock";
import {
  ArrowLeft,
  Check,
  PauseCircle,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";

import { Confirm, Heading, StateBadge, duration } from "@/components/common";
import { backFromRun, navigate, useStudio } from "@/lib/studio";
import { isActive } from "../../shared/run-status";
import type { RunDetail as Detail } from "../../shared/types";
import { useRun } from "../hooks/use-run-query";
import { Review } from "./run-review";
import { RunRecords } from "./run-records";
import { RunArtifact } from "./run-artifact";
export function RunDetail({ id }: { id: string }) {
  const run = useRun(id);
  const { state } = useStudio();
  if (!state.mock && state.service === "offline")
    return <p>启动本机服务后可查看这条 Run 的完整记录。</p>;
  if (!run)
    return <p>{run === null ? "找不到这条 Run。" : "正在读取运行详情…"}</p>;
  return <DetailPage run={run} />;
}
function DetailPage({ run }: { run: Detail }) {
  const { state, perform, show } = useStudio(),
    [resumeInput, setResumeInput] = useState<Record<string, string>>({}),
    [stop, setStop] = useState(false),
    [lost, setLost] = useState(false);
  const now = useClock(state.service !== "offline" && isActive(run));
  const { activity, durations } = run,
    usage = activity.usage,
    family = [run, ...run.children],
    affected = family.filter(isActive);
  const online = state.service === "online";
  const commandName = run.summary.command;
  const elapsed = Math.max(
    0,
    (state.service === "offline" ? Date.parse(run.summary.updatedAt) : now) -
      Date.parse(durations.since),
  );
  const work = durations.workMs + (durations.ticking === "work" ? elapsed : 0),
    wait = durations.waitMs + (durations.ticking === "wait" ? elapsed : 0);
  const count = usage.inputTokens.reported + usage.outputTokens.reported,
    lastModel = [
      ...activity.activeExecutions,
      ...activity.recentExecutions.slice().reverse(),
    ].find((call) => call.model)?.model?.model;
  const copy = () =>
    navigate(
      "/launch/" +
        encodeURIComponent(run.retryLoom) +
        "/" +
        encodeURIComponent(run.launch?.command ?? "") +
        "?copy=" +
        encodeURIComponent(run.summary.id),
    );
  return (
    <>
      <div>
        <Button
          size="sm"
          className="mb-2 -ml-2"
          variant="ghost"
          onClick={backFromRun}
        >
          <ArrowLeft />
          返回列表
        </Button>
        <Heading
          title={run.title}
          description={[
            run.summary.id,
            [run.summary.loom.id, run.summary.command ?? run.launch?.command]
              .filter(Boolean)
              .join(" / "),
            run.via && `${run.via} 发起`,
          ]
            .filter(Boolean)
            .join(" · ")}
          actions={
            <div className="flex items-center gap-2">
              <StateBadge run={run} />
              {isActive(run) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!online || run.summary.status === "stopping"}
                  onClick={() => setStop(true)}
                >
                  <Square />
                  停止 Run
                </Button>
              )}
            </div>
          }
        />
      </div>
      <div className="grid grid-cols-2 divide-x rounded-lg border bg-muted/35 py-3 md:grid-cols-4">
        {[
          ["执行用时", duration(work)],
          ["执行环境", run.binding?.profile ?? run.summary.harness ?? "未记录"],
          ["实际模型", lastModel || "暂无回执"],
          [
            "累计 Token",
            usage.inputTokens.receipts || usage.outputTokens.receipts
              ? count.toLocaleString()
              : "暂无回执",
          ],
        ].map(([k, v]) => (
          <div className="px-4" key={k}>
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="font-medium tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-3">
          {run.reviews.map((review) => (
            <Review key={review.request.id} {...review} />
          ))}
          <RunArtifact run={run} />
          {run.summary.status === "interrupted" ? (
            <Card>
              <CardHeader>
                <CardTitle>执行中断</CardTitle>
                <CardDescription>{run.message}</CardDescription>
              </CardHeader>
              {run.launch && (
                <CardFooter>
                  <Button variant="outline" onClick={copy}>
                    <RotateCcw />
                    用原输入新建…
                  </Button>
                </CardFooter>
              )}
            </Card>
          ) : (
            !run.reviews.length &&
            !run.delivered && (
              <div className="rounded-lg border p-5">
                <p className="text-xs">{run.statusLabel}</p>
                <h2>{run.message}</h2>
              </div>
            )
          )}
          {(run.summary.status === "waiting" ? run.summary.waits : [])
            .filter(
              (w) =>
                w.kind === "external" ||
                (w.kind === "interaction" &&
                  run.activity.interactions.some(
                    (q) => q.id === w.requestId && q.status === "answered",
                  )),
            )
            .map((w) => (
              <div key={w.waitId} className="flex gap-2">
                {!state.mock && w.kind === "external" && (
                  <input
                    aria-label="继续数据 JSON"
                    placeholder="继续数据（可选 JSON）"
                    value={resumeInput[w.waitId] ?? ""}
                    onChange={(e) =>
                      setResumeInput({
                        ...resumeInput,
                        [w.waitId]: e.target.value,
                      })
                    }
                  />
                )}
                <Button
                  disabled={
                    !online ||
                    (!!state.mock && !state.installed.includes(run.retryLoom))
                  }
                  onClick={() => {
                    try {
                      const raw = resumeInput[w.waitId]?.trim();
                      void perform({
                        type: "resume",
                        id: run.summary.id,
                        waitId: w.waitId,
                        requestId: w.requestId,
                        ...(raw ? { resumeData: JSON.parse(raw) } : {}),
                      });
                    } catch (e) {
                      show(String(e));
                    }
                  }}
                >
                  <Play />
                  继续此 Run
                </Button>
                {state.mock && !state.installed.includes(run.retryLoom) && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void perform({
                        type: "catalog",
                        id: run.retryLoom,
                        install: true,
                      })
                    }
                  >
                    安装原包
                  </Button>
                )}
              </div>
            ))}
          {state.mock &&
            family.some(
              (x) => x.summary.recoveryIssue?.code === "STOP_UNCONFIRMED",
            ) && (
              <Button
                onClick={() =>
                  void perform({ type: "verifyStop", id: run.summary.id })
                }
              >
                重新核实停止回执
              </Button>
            )}
          {run.summary.status === "failed" && (
            <div className="flex gap-2">
              {run.summary.error?.businessCode ? (
                commandName &&
                state.installed.includes(run.retryLoom) && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(
                        `/launch/${encodeURIComponent(run.retryLoom)}/${encodeURIComponent(commandName)}`,
                      )
                    }
                  >
                    重新填写参数
                  </Button>
                )
              ) : (
                <Button variant="outline" onClick={() => navigate("/settings")}>
                  打开运行配置
                </Button>
              )}
              {run.launch && <Button onClick={copy}>用原输入新建…</Button>}
            </div>
          )}
        </div>
        <section className="space-y-3 self-start rounded-lg border p-4">
          <h2 className="text-sm font-medium">本次步骤</h2>
          {activity.steps.map((step) => (
            <div key={step.label} className="flex items-center gap-2 text-sm">
              {step.counts.succeeded ? (
                <Check className="size-4 text-green-600" />
              ) : (step.counts.running || step.counts.waiting) > 0 ? (
                <PauseCircle className="size-4" />
              ) : (
                <span className="size-4 rounded-full border" />
              )}
              <span
                className={
                  (step.counts.running || step.counts.waiting) > 0
                    ? "font-medium"
                    : "text-muted-foreground"
                }
              >
                {step.label}
              </span>
            </div>
          ))}
        </section>
      </div>
      <RunRecords run={run} wait={wait} />
      <Confirm
        open={stop}
        onClose={() => setStop(false)}
        title={`停止「${run.title}」？`}
        description="将向以下运行请求取消。已写入项目的文件与既有交付保留。"
        action={`停止 ${affected.length} 条 Run`}
        onConfirm={() =>
          void perform({
            type: "cancel",
            id: run.summary.id,
            simulateLost: lost,
          })
        }
      >
        {state.mock && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lost}
              onChange={(e) => setLost(e.target.checked)}
            />
            演练执行器失联
          </label>
        )}
        {affected.map((x) => (
          <p key={x.summary.id} className="text-sm">
            {x.title} · {x.summary.id}
          </p>
        ))}
      </Confirm>
    </>
  );
}
