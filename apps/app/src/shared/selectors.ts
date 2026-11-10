import type { Settings, Configuration } from "./types.ts";
export function resolveConfiguration(
  settings: Settings,
  project: string,
  override: string,
): Configuration {
  const id = override || settings.projects[project] || settings.globalProfile,
    profile = settings.profiles.find((p) => p.id === id);
  if (!profile) throw Error("运行方案不存在，请重新选择。");
  const harness = settings.harnesses.find((h) => h.id === profile.harnessId);
  if (!harness) throw Error("运行方案缺少 Agent 执行器。");
  function binding(key: string) {
    const m = settings.models.find((m) => m.id === key),
      c = settings.credentials.find((c) => c.id === m?.credentialId);
    if (!m || !c) throw Error("模型或凭据引用缺失。");
    return {
      model: m.model,
      provider: m.provider,
      credentialRef: `env:${c.env}`,
    };
  }
  return {
    profile: profile.name,
    source: override
      ? "本次临时指定"
      : settings.projects[project]
        ? "项目默认"
        : "全局默认",
    ...(harness.availability === "missing"
      ? {
          startupIssue:
            "模拟启动检查失败：" +
            harness.name +
            " 不可用。请在运行资源中修复执行器后，用原输入新建 Run。",
        }
      : {}),
    harness: harness.name,
    adapter: harness.adapter,
    planner: binding(profile.planningModelId || profile.modelId),
    reviewer: binding(profile.modelId),
  };
}
