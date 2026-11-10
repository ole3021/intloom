import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import { Choice } from "@/components/common";
import { useStudio } from "@/lib/studio";

import type { Settings, ResourceEdit } from "../../shared/types";
export type Category = ResourceEdit["kind"];
export const labels = {
  models: "模型",
  credentials: "凭据",
  harnesses: "Agent 执行器",
  profiles: "运行方案",
};
export const choices = (rows: { id: string; name: string }[]) =>
  rows.map((x) => [x.id, x.name] as const);
type Edit = ResourceEdit;
export function startEdit(kind: Category, s: Settings, id?: string): Edit {
  const base = { id: id ?? crypto.randomUUID(), name: "" };
  switch (kind) {
    case "models":
      return {
        kind,
        value: s.models.find((m) => m.id === id) ?? {
          ...base,
          model: "",
          provider: "OpenAI",
          credentialId: s.credentials[0].id,
        },
      };
    case "credentials":
      return {
        kind,
        value: s.credentials.find((c) => c.id === id) ?? { ...base, env: "" },
      };
    case "harnesses":
      return {
        kind,
        value: s.harnesses.find((h) => h.id === id) ?? {
          ...base,
          adapter: "Mastra",
          availability: "ready",
        },
      };
    case "profiles":
      return {
        kind,
        value: s.profiles.find((p) => p.id === id) ?? {
          ...base,
          modelId: s.models[0].id,
          planningModelId: "",
          harnessId: s.harnesses[0].id,
        },
      };
  }
}
export function ResourceEditor({
  edit: initial,
  onClose,
}: {
  edit: Edit;
  onClose: () => void;
}) {
  const { state, api } = useStudio(),
    s = state.settings;
  const [edit, setEdit] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function fields<T extends { name: string }>(
    value: T,
    change: (v: T) => void,
  ) {
    const text = (key: keyof T & string, label: string) => (
      <div className="space-y-1.5">
        <Label htmlFor={`edit-${key}`}>{label}</Label>
        <Input
          id={`edit-${key}`}
          value={String(value[key] ?? "")}
          required
          onChange={(e) => change({ ...value, [key]: e.target.value })}
        />
      </div>
    );
    const choice = (
      key: keyof T & string,
      label: string,
      options: readonly (readonly [string, string])[],
      fallback = "",
    ) => (
      <Label>
        {label}
        <Choice
          label={label}
          value={String(value[key] ?? fallback)}
          onChange={(v) => change({ ...value, [key]: v })}
          options={options}
        />
      </Label>
    );
    return { text, choice };
  }
  function form() {
    switch (edit.kind) {
      case "models": {
        const { text, choice } = fields(edit.value, (value) =>
          setEdit({ kind: "models", value }),
        );
        return (
          <>
            {text("name", "名称")}
            {text("provider", "提供方")}
            {text("model", "模型 ID")}
            {choice("credentialId", "引用凭据", choices(s.credentials))}
          </>
        );
      }
      case "credentials": {
        const { text } = fields(edit.value, (value) =>
          setEdit({ kind: "credentials", value }),
        );
        return (
          <>
            {text("name", "名称")}
            {text("env", "环境变量名")}
          </>
        );
      }
      case "harnesses": {
        const { text, choice } = fields(edit.value, (value) =>
          setEdit({ kind: "harnesses", value }),
        );
        return (
          <>
            {text("name", "名称")}
            {choice("adapter", "模拟适配器", [
              ["Mastra", "Mastra"],
              ["OpenCode", "OpenCode"],
            ])}
            {choice(
              "availability",
              "模拟启动检查",
              [
                ["ready", "可用"],
                ["missing", "不可用（演练启动失败）"],
              ],
              "ready",
            )}
          </>
        );
      }
      case "profiles": {
        const { text, choice } = fields(edit.value, (value) =>
          setEdit({ kind: "profiles", value }),
        );
        return (
          <>
            {text("name", "名称")}
            {choice("modelId", "默认模型", choices(s.models))}
            {choice("planningModelId", "文稿策划模型", [
              ["", "跟随方案默认"],
              ...choices(s.models),
            ])}
            {choice("harnessId", "Agent 执行器", choices(s.harnesses))}
          </>
        );
      }
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api.act({ type: "saveResource", resource: edit });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>配置{labels[edit.kind]}</DialogTitle>
          <DialogDescription>
            {edit.kind === "credentials"
              ? "保存本机环境变量的引用。Mock 不读取密钥值。"
              : "更改用于后续新 Run，历史记录保留启动时的配置。"}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={save}
          className="space-y-4"
          data-update-draft={
            JSON.stringify(edit) !== JSON.stringify(initial)
              ? "运行配置"
              : undefined
          }
        >
          {form()}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={busy}>
              保存{labels[edit.kind]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
