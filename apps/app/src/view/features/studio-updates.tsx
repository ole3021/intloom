import { useState } from "react";
import { ArrowDownCircle, ExternalLink, X } from "lucide-react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { navigate, useStudio } from "@/lib/studio";
import {
  blocksStudioRestart,
  type StudioUpdate,
  type UpdateCommand,
} from "../../shared/updates";

const labels: Record<StudioUpdate["phase"], string> = {
  disabled: "更新不可用",
  idle: "检查稳定版",
  checking: "正在检查更新…",
  current: "已是最新版本",
  available: "发现新版本",
  downloading: "正在下载",
  verifying: "正在校验更新包…",
  ready: "可重启更新",
  applying: "正在重启并更新…",
  failed: "更新未完成",
};

export function UpdateDetails({ onClose }: { onClose?: () => void }) {
  const { api, state } = useStudio();
  const [error, setError] = useState("");
  const u = state.update;
  const blockers =
    u.phase === "ready" && (state.mock || state.service !== "offline")
      ? state.runs.filter(blocksStudioRestart)
      : [];
  async function act(command: UpdateCommand) {
    setError("");
    if (command.action === "apply") {
      const draft = document.querySelector<HTMLElement>("[data-update-draft]");
      if (draft) {
        setError("请先处理未保存的" + draft.dataset.updateDraft + "。");
        return;
      }
    }
    try {
      await api.update(command);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div className="space-y-3 text-sm">
      <div role="status" className="space-y-1">
        <h3 className="font-semibold">
          {labels[u.phase]}
          {u.target ? " · " + u.target : ""}
        </h3>
        <p className="text-muted-foreground">当前版本 {u.current}</p>
        {u.result && <p>{u.result}</p>}
        {u.message && <p>{u.message}</p>}
      </div>
      {u.notes && (
        <details open={u.phase === "available"}>
          <summary className="cursor-pointer font-medium">版本说明</summary>
          <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-muted-foreground">
            {u.notes}
          </p>
        </details>
      )}
      {u.phase === "downloading" && (
        <div className="flex items-center gap-2">
          <progress
            className="min-w-0 flex-1 accent-primary"
            aria-label="更新下载进度"
            value={u.progress}
            max={100}
          />
          {u.progress !== undefined && <span>{u.progress}%</span>}
        </div>
      )}
      {blockers.length > 0 && (
        <div className="space-y-1">
          <p>以下运行结束后可以重启：</p>
          {blockers.map((r) => (
            <Button
              key={r.summary.id}
              variant="link"
              size="sm"
              className="h-auto block whitespace-normal p-0 text-left"
              onClick={() => {
                if (document.querySelector("[data-update-draft]")) {
                  setError("请先处理当前页面未保存的输入。");
                  return;
                }
                onClose?.();
                navigate("/run/" + encodeURIComponent(r.summary.id));
              }}
            >
              {r.title} · {r.summary.id}
            </Button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {["idle", "current", "failed", "available"].includes(u.phase) && (
          <Button
            variant={u.phase === "available" ? "outline" : "default"}
            size="sm"
            onClick={() => void act({ action: "check" })}
          >
            检查更新
          </Button>
        )}
        {(u.phase === "available" || (u.phase === "failed" && u.target)) && (
          <Button size="sm" onClick={() => void act({ action: "download" })}>
            {u.phase === "failed" ? "重新下载" : "下载更新"}
          </Button>
        )}
        {u.phase === "ready" && (
          <Button
            size="sm"
            disabled={!!blockers.length}
            onClick={() =>
              void act({ action: "apply", route: location.hash || "#/" })
            }
          >
            重启并更新
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            稍后
          </Button>
        )}
        {!onClose && u.phase !== "disabled" && (
          <Button
            variant="link"
            size="sm"
            onClick={() => void act({ action: "release" })}
          >
            <ExternalLink />
            发行说明与安装包
          </Button>
        )}
      </div>
    </div>
  );
}

export function UpdateReminder() {
  const {
    state: { update: u },
  } = useStudio();
  const [open, setOpen] = useState(false);
  if (!u.target && !open) return null;
  const label =
    u.phase === "downloading" && u.progress !== undefined
      ? u.progress + "%"
      : u.phase === "available"
        ? u.target
        : labels[u.phase];
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <SidebarMenuButton
              tooltip={`Studio 更新 · ${label}`}
              aria-label={`Studio 更新 · ${label}`}
            >
              <ArrowDownCircle />
              <span>Studio 更新</span>
              <Badge variant="secondary" className="ml-auto">
                {label}
              </Badge>
            </SidebarMenuButton>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="top"
              align="start"
              sideOffset={8}
              collisionPadding={12}
              className="z-50 w-80 max-w-[calc(100vw-1.5rem)] space-y-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-md"
              aria-label="Studio 更新"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">应用更新</span>
                <Popover.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="收起更新面板"
                  >
                    <X />
                  </Button>
                </Popover.Close>
              </div>
              <UpdateDetails onClose={() => setOpen(false)} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
