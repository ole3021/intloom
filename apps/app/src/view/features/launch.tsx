import { useState } from "react";
import { FolderOpen, Plus, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { Heading, Choice, Facts } from "@/components/common";

import { navigate, useStudio } from "@/lib/studio";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { resolveConfiguration } from "../../shared/selectors";
import {
  fileName,
  type Input as BusinessInput,
  type Launch,
  type Command,
  type PackageInfo,
} from "../../shared/types";
import { useRun } from "../hooks/use-run-query";
export function LaunchPage({
  pkg,
  command,
  copy,
}: {
  pkg: PackageInfo;
  command: Command;
  copy: string | null;
}) {
  const original = useRun(copy);
  if (copy && !original)
    return (
      <p>{original === null ? "找不到要复用的 Run。" : "正在读取原输入…"}</p>
    );
  return <LaunchForm pkg={pkg} command={command} original={original?.launch} />;
}
function LaunchForm({
  pkg,
  command,
  original,
}: {
  pkg: PackageInfo;
  command: Command;
  original?: Launch;
}) {
  const { state, api, perform, show } = useStudio();

  const [input, setInput] = useState<BusinessInput>(() =>
      original
        ? structuredClone(original.input)
        : Object.fromEntries(
            Object.entries(command.input.properties).map(([key, f]) => [
              key,
              f.default ??
                (f.type === "array" ? [] : f.type === "boolean" ? false : ""),
            ]),
          ),
    ),
    [project, setProject] = useState(original?.projectDir || ""),
    [profile, setProfile] = useState(original?.profileId || ""),
    [confirm, setConfirm] = useState(original?.finalConfirmation ?? false),
    [sourceMode, setSourceMode] = useState<"prompt" | "files">(
      original?.input.files ? "files" : "prompt",
    ),
    [json, setJson] = useState("{}"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const binding = state.mock
    ? resolveConfiguration(state.settings, project, profile)
    : undefined;
  const firstFile = Array.isArray(input.files) ? input.files[0] : undefined;
  const sourcePath =
    typeof firstFile === "object" && "path" in firstFile ? firstFile.path : "";
  const missingSource =
    command.textOrFile &&
    (sourceMode === "files" ? !sourcePath : !String(input.prompt ?? "").trim());
  const draft = JSON.stringify([
    input,
    project,
    profile,
    confirm,
    json,
    sourceMode,
  ]);
  const [initialDraft] = useState(draft);
  const set = (k: string, v: BusinessInput[string]) => {
    setInput((s) => ({ ...s, [k]: v }));
    setError("");
  };
  async function pick(
    key: string,
    kind: "directory" | "file" | "files",
    projectField = false,
  ) {
    try {
      const paths = await api.pick(kind);
      if (!paths.length) return;
      if (projectField) setProject(paths[0]);
      else if (command.textOrFile && key === "files")
        set(key, [{ kind: "input-file", path: paths[0] }]);
      else if (kind === "files")
        set(key, [...new Set([...((input[key] as string[]) ?? []), ...paths])]);
      else
        set(
          key,
          command.input.properties[key].type === "array"
            ? [paths[0]]
            : paths[0],
        );
    } catch (e) {
      show(String(e));
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || missingSource) return;
    const draft: Launch = {
      loom: pkg.ref.id,
      command: command.name,
      input: command.textOrFile
        ? { [sourceMode]: input[sourceMode] }
        : Object.fromEntries(
            Object.entries(input).filter(
              ([key, v]) =>
                command.input.required.includes(key) ||
                (v !== "" && (!Array.isArray(v) || v.length > 0)),
            ),
          ),
      projectDir: project,
      profileId: profile,
      finalConfirmation: confirm,
    };
    setBusy(true);
    try {
      const result = await api.act({
        type: "launch",
        draft,
        ...(command.jsonSchema ? { jsonInput: JSON.parse(json) } : {}),
      });
      if (result.issue) show(result.issue);
      if (result.createdId) navigate(`/run/${result.createdId}`);
      if (result.receipt) navigate(`/run/${result.receipt.run.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title={command.title}
        description={`${pkg.name} / ${command.name} · ${command.output}`}
      />
      <form
        onSubmit={submit}
        className="space-y-6"
        data-update-draft={draft !== initialDraft ? "启动参数" : undefined}
      >
        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-5">
            {command.textOrFile && (
              <Tabs
                value={sourceMode}
                onValueChange={(value) => {
                  setSourceMode(value === "files" ? "files" : "prompt");
                  setError("");
                }}
              >
                <TabsList aria-label="输入方式">
                  <TabsTrigger value="prompt">粘贴文本</TabsTrigger>
                  <TabsTrigger value="files">本地文件</TabsTrigger>
                </TabsList>
                <TabsContent value="prompt" className="space-y-2">
                  <Label htmlFor="source-text">原文</Label>
                  <Textarea
                    id="source-text"
                    rows={8}
                    value={String(input.prompt ?? "")}
                    onChange={(event) => set("prompt", event.target.value)}
                  />
                </TabsContent>
                <TabsContent value="files" className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void pick("files", "file")}
                  >
                    <FolderOpen />
                    {sourcePath ? "更换文件" : "选择文件…"}
                  </Button>
                  {sourcePath && (
                    <p className="break-all text-sm" role="status">
                      {sourcePath}
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            )}
            {command.jsonSchema && (
              <Label>
                业务输入（JSON）
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(command.jsonSchema, null, 2)}
                </pre>
                <Textarea
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                />
              </Label>
            )}
            {Object.entries(command.input.properties).map(([k, f]) => {
              if (f.type === "boolean")
                return (
                  <Label key={k} className="flex gap-2">
                    <Checkbox
                      checked={!!input[k]}
                      onCheckedChange={(v) => set(k, v === true)}
                    />
                    {f.title}
                  </Label>
                );
              if (f.format === "pairs")
                return (
                  <PairField
                    key={k}
                    title={f.title}
                    value={
                      (input[k] as { raw: string; edited: string }[]) ?? []
                    }
                    onChange={(v) => set(k, v)}
                  />
                );
              if (f.type === "array")
                return (
                  <div key={k} className="space-y-2">
                    <Label>
                      {f.title}
                      {command.input.required.includes(k) && " · 必填"}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void pick(k, f.maxItems === 1 ? "file" : "files")
                        }
                      >
                        <Plus />
                        选择文件
                      </Button>
                      {state.mock && (
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() =>
                            set(k, state.mock?.files[command.name] ?? [])
                          }
                        >
                          使用示例素材
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {((input[k] as string[] | undefined) ?? []).map(
                        (path) => (
                          <Badge variant="secondary" key={path}>
                            {fileName(path)}
                            <button
                              aria-label={`移除 ${fileName(path)}`}
                              type="button"
                              onClick={() =>
                                set(
                                  k,
                                  (input[k] as string[]).filter(
                                    (p) => p !== path,
                                  ),
                                )
                              }
                            >
                              <X size={12} />
                            </button>
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                );
              return (
                <div className="space-y-2" key={k}>
                  <Label htmlFor={`field-${k}`}>
                    {f.title}
                    {command.input.required.includes(k) && " · 必填"}
                  </Label>
                  {(f.format === "file" || f.format === "directory") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void pick(
                          k,
                          f.format === "directory" ? "directory" : "file",
                        )
                      }
                    >
                      {f.format === "directory" ? "选择目录" : "选择文件"}
                    </Button>
                  )}
                  <Input
                    id={`field-${k}`}
                    type={f.type === "integer" ? "number" : "text"}
                    min={f.minimum}
                    max={f.maximum}
                    required={command.input.required.includes(k)}
                    placeholder={
                      state.mock && k === "title"
                        ? "例如：春季发布会演示稿"
                        : undefined
                    }
                    value={String(input[k] ?? "")}
                    onChange={(e) =>
                      set(
                        k,
                        f.type === "integer"
                          ? e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                          : e.target.value,
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
          <Card className="self-start">
            <CardHeader>
              <CardTitle>本次运行环境</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>业务项目目录</Label>
                <Choice
                  label="业务项目目录"
                  value={project}
                  onChange={setProject}
                  options={[
                    ["", "不指定项目"],
                    ...[
                      ...new Set([
                        ...(state.mock?.projects ?? []),
                        ...Object.keys(state.settings.projects),
                        ...(project ? [project] : []),
                      ]),
                    ].map((p) => [p, fileName(p)] as const),
                  ]}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void pick("project", "directory", true)}
                >
                  <FolderOpen />
                  选择目录
                </Button>
                <p className="break-all text-xs text-muted-foreground">
                  {project}
                </p>
              </div>
              {binding && (
                <>
                  <Label>运行方案</Label>
                  <Choice
                    label="本次运行方案"
                    value={profile}
                    onChange={setProfile}
                    options={[
                      ["", "跟随默认"],
                      ...state.settings.profiles.map(
                        (p) => [p.id, `仅本次 · ${p.name}`] as const,
                      ),
                    ]}
                  />
                  <Facts
                    items={[
                      ["生效方案", binding.profile],
                      ["选择来源", binding.source],
                      ["策划模型", binding.planner.model],
                      ["执行器", binding.harness],
                    ]}
                  />
                </>
              )}
              <Label>
                <Checkbox
                  checked={confirm}
                  onCheckedChange={(v) => setConfirm(v === true)}
                />
                交付前由我确认
              </Label>
            </CardContent>
          </Card>
        </div>
        {!state.installed.includes(pkg.ref.id) && (
          <p>
            原包已卸载。
            <Button
              variant="link"
              type="button"
              onClick={() =>
                void perform({ type: "catalog", id: pkg.ref.id, install: true })
              }
            >
              安装原包
            </Button>
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end border-t pt-4">
          {state.service === "online" || !state.mock ? (
            <Button
              type="submit"
              disabled={
                busy || missingSource || !state.installed.includes(pkg.ref.id)
              }
            >
              <Play />
              {busy ? "提交中" : "启动 Run"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void perform({ type: "service", online: true })}
            >
              启动 Mock Kernel
            </Button>
          )}
        </div>
      </form>
    </>
  );
}

function PairField({
  title,
  value,
  onChange,
}: {
  title: string;
  value: { raw: string; edited: string }[];
  onChange: (pairs: { raw: string; edited: string }[]) => void;
}) {
  const { api, show } = useStudio();
  const [rows, setRows] = useState(() =>
    value.map((pair) => ({ ...pair, id: crypto.randomUUID() })),
  );
  function update(next: typeof rows) {
    setRows(next);
    onChange(next.map(({ raw, edited }) => ({ raw, edited })));
  }
  async function choose(id: string, key: "raw" | "edited") {
    try {
      const [path] = await api.pick("file");
      if (path)
        update(
          rows.map((row) => (row.id === id ? { ...row, [key]: path } : row)),
        );
    } catch (error) {
      show(String(error));
    }
  }
  return (
    <fieldset className="space-y-2">
      <legend>{title} · 必填</legend>
      {rows.map((pair) => (
        <div key={pair.id} className="flex flex-wrap gap-2">
          {(["raw", "edited"] as const).map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              onClick={() => void choose(pair.id, key)}
            >
              {pair[key]
                ? fileName(pair[key])
                : key === "raw"
                  ? "选择 RAW"
                  : "选择成片"}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={() => update(rows.filter((row) => row.id !== pair.id))}
          >
            移除
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          update([...rows, { id: crypto.randomUUID(), raw: "", edited: "" }])
        }
      >
        添加对照组
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          update([
            {
              id: crypto.randomUUID(),
              raw: "示例/原片.dng",
              edited: "示例/成片.jpg",
            },
          ])
        }
      >
        使用示例素材
      </Button>
    </fieldset>
  );
}
