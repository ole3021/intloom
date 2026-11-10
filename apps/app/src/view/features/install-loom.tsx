import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  FolderOpen,
  LoaderCircle,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Choice } from "@/components/common";
import { useStudio, navigate } from "@/lib/studio";
import type { LoomInstallPreview } from "../../shared/types";

export function InstallLoom({ onClose }: { onClose: () => void }) {
  const { api, state, refresh } = useStudio();
  const [input, setInput] = useState({ source: "" });
  const { source } = input;
  const [candidates, setCandidates] = useState<LoomInstallPreview[]>([]);
  const [selection, select] = useState("");
  const [issue, setIssue] = useState("");
  const [phase, setPhase] = useState<
    "input" | "installing" | "checking" | "refresh" | "done"
  >("input");
  const chosen = candidates.find((p) => p.spec === selection);
  const busy = phase === "installing" || phase === "checking";
  function edit(value: string) {
    setInput({ source: value });
    select("");
    setCandidates([]);
    setIssue("");
  }
  useEffect(() => {
    if (!input.source.trim()) return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const result = await api.previewLoom(input.source.trim());
        if (current) {
          setCandidates(result);
          select(result.length === 1 ? result[0].spec : "");
        }
      } catch (e) {
        if (current) setIssue(e instanceof Error ? e.message : String(e));
      }
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [input, api]);
  function openPackage(pkg: LoomInstallPreview) {
    onClose();
    navigate("/loom/" + encodeURIComponent(pkg.id));
  }
  async function checkLibrary(pkg: LoomInstallPreview, open: boolean) {
    setPhase("checking");
    setIssue("");
    try {
      if (state.service !== "online")
        await api.act({ type: "service", online: true });
      const data = await refresh();
      if (
        data.service !== "online" ||
        !data.installed.includes(pkg.id) ||
        !data.catalog.some(
          (p) =>
            p.ref.id === pkg.id &&
            p.ref.version === pkg.version &&
            p.ref.artifactDigest === pkg.artifactDigest,
        )
      )
        throw Error(
          data.connection?.issue || "Loom 库暂时未读到所选版本，请重新读取。",
        );
      if (open) openPackage(pkg);
      else setPhase("done");
    } catch (e) {
      setIssue(e instanceof Error ? e.message : String(e));
      setPhase("refresh");
    }
  }
  async function install(pkg: LoomInstallPreview) {
    if (pkg.installed === "same") return checkLibrary(pkg, true);
    setIssue("");
    setPhase("installing");
    try {
      await api.act({
        type: "catalog",
        id: pkg.spec,
        install: true,
        integrity: pkg.integrity,
      });
    } catch (e) {
      setPhase("input");
      setIssue(e instanceof Error ? e.message : String(e));
      return;
    }
    await checkLibrary(pkg, false);
  }
  const label =
    chosen?.installed === "same"
      ? "打开 Loom"
      : chosen?.installed === "incomplete"
        ? "修复安装"
        : chosen?.installed === "changed"
          ? chosen.version === chosen.installedVersion
            ? "替换安装"
            : "更换版本"
          : "安装";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {phase === "done" ? (
              <span className="flex items-center gap-2">
                <Check className="size-5" />
                安装完成
              </span>
            ) : (
              "安装 Loom"
            )}
          </DialogTitle>
          <DialogDescription>
            {state.mock
              ? "当前为演练模式，使用本地示例包。"
              : "安装位置 · 本机全局 Loom 库"}
          </DialogDescription>
        </DialogHeader>
        {phase !== "done" && (
          <div className="grid gap-2">
            <Label htmlFor="loom-install-source">包名或地址</Label>
            <Input
              id="loom-install-source"
              data-update-draft={source ? "安装来源" : undefined}
              value={source}
              disabled={busy || phase === "refresh"}
              onChange={(e) => edit(e.target.value)}
              spellCheck={false}
              placeholder="粘贴 GitHub 地址、npm 包名或 npm 链接"
            />
            {phase === "input" &&
              (state.mock ? (
                <div className="flex flex-wrap gap-2">
                  {state.catalog.map((pkg) => (
                    <Button
                      key={pkg.ref.id}
                      variant="outline"
                      size="sm"
                      onClick={() => edit(pkg.ref.id)}
                    >
                      {pkg.ref.id}
                    </Button>
                  ))}
                </div>
              ) : (
                <Button
                  className="justify-self-start"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      const [file] = await api.pick("file");
                      if (file) edit(file);
                    } catch (e) {
                      setIssue(String(e));
                    }
                  }}
                >
                  <FolderOpen />
                  选择本地 .tgz…
                </Button>
              ))}
          </div>
        )}
        {candidates.length > 1 && phase !== "done" && (
          <fieldset disabled={busy || phase === "refresh"}>
            <Choice
              label="选择发布包"
              value={selection}
              onChange={(value) => {
                select(value);
                setIssue("");
              }}
              options={[
                ["", "选择要安装的 Loom"],
                ...candidates.map((p): [string, string] => [
                  p.spec,
                  p.name +
                    " · " +
                    p.id +
                    "@" +
                    p.version +
                    " · " +
                    p.sourceLabel.split(" · ").at(-1),
                ]),
              ]}
            />
          </fieldset>
        )}
        {chosen && (
          <div className="flex min-w-0 gap-3 rounded-lg border bg-muted/40 p-4">
            <Package className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 space-y-1 break-words">
              <div className="font-medium">{chosen.name}</div>
              <div className="break-all font-mono text-xs">
                {chosen.id} · {chosen.version}
              </div>
              <p className="text-sm">{chosen.description}</p>
              <p className="text-xs text-muted-foreground">
                {chosen.sourceLabel}
              </p>
              {phase === "input" && chosen.installedVersion && (
                <p className="text-sm">
                  {chosen.version !== chosen.installedVersion
                    ? "本机版本 " +
                      chosen.installedVersion +
                      " → " +
                      chosen.version
                    : chosen.installed === "same"
                      ? "本机已安装相同内容"
                      : chosen.installed === "incomplete"
                        ? "已安装的 Loom 缺少所需依赖"
                        : "该版本的包内容与本机不同"}
                </p>
              )}
            </div>
          </div>
        )}
        {source.trim() && !issue && !candidates.length && (
          <p role="status" className="text-sm text-muted-foreground">
            正在读取包信息…
          </p>
        )}
        {issue && (
          <p role="alert" className="break-words text-sm text-destructive">
            {issue}
          </p>
        )}
        <DialogFooter>
          {phase === "done" && chosen ? (
            <>
              <Button variant="outline" onClick={onClose}>
                返回 Loom 库
              </Button>
              <Button onClick={() => openPackage(chosen)}>
                打开 Loom
                <ArrowUpRight />
              </Button>
            </>
          ) : phase === "refresh" && chosen ? (
            <Button
              onClick={() =>
                void checkLibrary(chosen, chosen.installed === "same")
              }
            >
              重新读取 Loom 库
            </Button>
          ) : (
            <>
              {issue && (
                <Button
                  variant="outline"
                  onClick={() => {
                    edit(source);
                  }}
                >
                  {candidates.length ? "重新读取包信息" : "重试"}
                </Button>
              )}
              <Button
                disabled={!chosen || busy}
                onClick={() => chosen && void install(chosen)}
              >
                {busy && <LoaderCircle className="animate-spin" />}
                {phase === "installing"
                  ? "安装中…"
                  : phase === "checking"
                    ? "正在读取 Loom 库…"
                    : label}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
