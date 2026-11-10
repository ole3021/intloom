import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading, Confirm, Facts } from "@/components/common";
import { useStudio } from "@/lib/studio";
import { isActive } from "../../shared/run-status";
export function ServicePage() {
  const { state, perform } = useStudio(),
    [confirm, setConfirm] = useState(false),
    [lost, setLost] = useState(false),
    active = state.runs.filter(isActive);
  return (
    <>
      <Heading
        title="本机服务"
        description={
          state.mock
            ? "独立 Mock Kernel · 用于验证桌面交互。"
            : "管理 Studio、CLI 和 MCP 共用的本机服务。"
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Kernel 状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Facts
            items={[
              [
                "当前状态",
                { online: "在线", offline: "离线", stopping: "正在关闭" }[
                  state.service
                ],
              ],
              ["未结束 Run", active.length],
              [
                "MCP",
                state.mock
                  ? "模拟来源，本演练不监听 MCP 端口"
                  : (state.connection?.mcpUrl ?? "离线"),
              ],
              [
                "关闭窗口",
                state.mock
                  ? "任务在应用主进程中继续执行"
                  : "任务在独立服务中继续执行",
              ],
              ...(!state.mock && state.connection?.version
                ? ([
                    ["服务版本", state.connection.version],
                    ["全局包目录", state.connection.npmRoot],
                  ] as [string, string | undefined][])
                : []),
            ]}
          />
          {state.service === "offline" ? (
            <Button
              onClick={() => void perform({ type: "service", online: true })}
            >
              {state.mock ? "启动 Mock Kernel" : "启动本机服务"}
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={state.service === "stopping"}
              onClick={() => setConfirm(true)}
            >
              关闭 Kernel…
            </Button>
          )}
          {state.mock &&
            active.some(
              (r) => r.summary.recoveryIssue?.code === "STOP_UNCONFIRMED",
            ) && (
              <Button
                variant="outline"
                onClick={() => void perform({ type: "verifyStop" })}
              >
                重新核实停止回执
              </Button>
            )}
        </CardContent>
      </Card>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`停止 ${active.length} 条 Run 并关闭 Kernel？`}
        description="所有未结束的 App、CLI、MCP 任务及其子 Run 都将收到取消请求。停止回执齐备后服务离线，历史与交付文件保留。"
        action={`停止 ${active.length} 条 Run 并关闭 Kernel`}
        onConfirm={() =>
          void perform({ type: "service", online: false, simulateLost: lost })
        }
      >
        {state.mock && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lost}
              onChange={(e) => setLost(e.target.checked)}
            />
            演练一个执行器失联
          </label>
        )}
        <div className="max-h-60 space-y-1 overflow-auto">
          {active.map((x) => (
            <div
              key={x.summary.id}
              className="flex justify-between gap-2 border-b py-1 text-sm"
            >
              <span>
                {x.summary.parentRunId ? "↳ " : ""}
                {x.title}
              </span>
              <span>
                {x.via} · {x.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </Confirm>
    </>
  );
}
