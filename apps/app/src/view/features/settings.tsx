import { useEffect, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Choice, Heading } from "@/components/common";
import { useStudio } from "@/lib/studio";

import {
  fileName,
  type Settings,
  type DesktopApi,
  type ResourceEdit,
} from "../../shared/types";
import {
  choices,
  labels,
  startEdit,
  ResourceEditor,
  type Category,
} from "./settings-editor";
export function SettingsPage() {
  const { state, api, perform, show } = useStudio(),
    s = state.settings,
    [tab, setTab] = useState(state.mock ? "resources" : "display"),
    [kind, setKind] = useState<Category>("models"),
    [edit, setEdit] = useState<ResourceEdit | null>(null),
    [project, setProject] = useState(state.mock?.projects[0] ?? "");
  const [configuration, setConfiguration] =
    useState<Awaited<ReturnType<NonNullable<DesktopApi["configuration"]>>>>();
  const [issue, setIssue] = useState("");
  useEffect(() => {
    let live = true;
    setIssue("");
    setConfiguration(undefined);
    if (!state.mock && state.service === "online")
      void api.configuration?.(project || undefined).then(
        (c) => {
          if (live) setConfiguration(c);
        },
        (e) => {
          if (live) setIssue(String(e));
        },
      );
    return () => {
      live = false;
    };
  }, [api, state.mock, state.service, project]);
  const save = (
    patch: Partial<
      Pick<
        Settings,
        "theme" | "globalProfile" | "notifications" | "reduceMotion"
      >
    >,
  ) => perform({ type: "preferences", patch });
  const resource = (k: Category) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{labels[k]}</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEdit(startEdit(k, s))}
        >
          <Plus />
          新建{labels[k]}
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {s[k].map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div>
              <h3 className="text-sm font-medium">{r.name}</h3>
              <p className="text-xs text-muted-foreground">
                {"provider" in r
                  ? r.provider +
                    " / " +
                    r.model +
                    " · " +
                    s.credentials.find((c) => c.id === r.credentialId)?.name
                  : "env" in r
                    ? `env:${r.env}`
                    : "adapter" in r
                      ? r.adapter
                      : s.models.find((m) => m.id === r.modelId)?.name +
                        " · " +
                        s.harnesses.find((h) => h.id === r.harnessId)?.name}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`配置 ${r.name}`}
              onClick={() => setEdit(startEdit(k, s, r.id))}
            >
              <Settings2 />
              配置
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
  return (
    <>
      <Heading
        title="运行配置"
        description="在本机维护运行资源、复用方案和项目默认值。"
      />
      {state.connection && (
        <Card>
          <CardHeader>
            <CardTitle>Kernel 运行配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>全局配置 · {state.connection.config}</p>
            <p>业务项目 · {project || "未指定"}</p>
            <Button
              variant="outline"
              onClick={() =>
                void api
                  .pick("directory")
                  .then(([p]) => {
                    if (p) setProject(p);
                  })
                  .catch((e) => show(String(e)))
              }
            >
              查看项目配置…
            </Button>
            {project && (
              <Button variant="ghost" onClick={() => setProject("")}>
                查看全局配置
              </Button>
            )}
            {issue && <p role="alert">{issue}</p>}
            {configuration && (
              <>
                <p>执行器 · {configuration.harness}</p>
                {configuration.profiles.length === 0 && (
                  <p>尚未配置模型方案。</p>
                )}
                {[...configuration.profiles, ...configuration.slots].map(
                  (b) => (
                    <p key={b.name}>
                      {b.name} · {b.provider} / {b.model} · {b.credentialRef}
                    </p>
                  ),
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="max-w-full flex-wrap">
          {state.mock && (
            <>
              <TabsTrigger value="resources">运行资源</TabsTrigger>
              <TabsTrigger value="profiles">运行方案</TabsTrigger>
              <TabsTrigger value="defaults">项目与默认值</TabsTrigger>
            </>
          )}
          <TabsTrigger value="display">外观与提醒</TabsTrigger>
        </TabsList>
        <TabsContent value="resources" className="space-y-5">
          <div className="flex gap-2">
            {(["models", "credentials", "harnesses"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={kind === k ? "secondary" : "ghost"}
                onClick={() => setKind(k)}
              >
                {labels[k]}
              </Button>
            ))}
          </div>
          {resource(kind)}
        </TabsContent>
        <TabsContent value="profiles">{resource("profiles")}</TabsContent>
        <TabsContent value="defaults">
          <Card>
            <CardHeader>
              <CardTitle>全局与项目默认</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <Label>
                全局默认方案
                <Choice
                  label="全局默认方案"
                  value={s.globalProfile}
                  options={choices(s.profiles)}
                  onChange={(v) => void save({ globalProfile: v })}
                />
              </Label>
              <div className="flex flex-wrap items-center gap-3">
                <Label>
                  业务项目
                  <Choice
                    label="业务项目"
                    value={project}
                    options={[
                      ...new Set([
                        ...(state.mock?.projects ?? []),
                        ...Object.keys(s.projects),
                        project,
                      ]),
                    ].map((p) => [p, fileName(p)])}
                    onChange={setProject}
                  />
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void api
                      .pick("directory")
                      .then(([p]) => {
                        if (p) setProject(p);
                      })
                      .catch((e) => show(String(e)))
                  }
                >
                  选择项目目录
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{project}</p>
              <Label>
                项目默认方案
                <Choice
                  label="项目默认方案"
                  value={s.projects[project] || ""}
                  options={[["", "跟随全局"], ...choices(s.profiles)]}
                  onChange={(v) => {
                    void perform({
                      type: "projectDefault",
                      project,
                      profileId: v,
                    });
                  }}
                />
              </Label>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle>外观与提醒</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Label>
                主题
                <Choice
                  label="主题"
                  value={s.theme}
                  onChange={(v) => void save({ theme: v as Settings["theme"] })}
                  options={[
                    ["system", "跟随系统"],
                    ["light", "浅色"],
                    ["dark", "深色"],
                  ]}
                />
              </Label>
              <Label>
                <Switch
                  checked={s.reduceMotion}
                  onCheckedChange={(v) => void save({ reduceMotion: v })}
                />
                减少动态效果
              </Label>
              <Label>
                <Switch
                  checked={s.notifications}
                  onCheckedChange={(v) => void save({ notifications: v })}
                />
                后台系统通知
              </Label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {edit && <ResourceEditor edit={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
