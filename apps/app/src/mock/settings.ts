import { resolveConfiguration } from "../shared/selectors.ts";
import type { Settings, SettingsChange } from "../shared/types.ts";
export function updateSettings(
  current: Settings,
  action: SettingsChange,
): Settings {
  const settings = structuredClone(current);
  if (action.type === "preferences") Object.assign(settings, action.patch);
  else if (action.type === "projectDefault") {
    if (action.profileId) settings.projects[action.project] = action.profileId;
    else delete settings.projects[action.project];
  } else {
    const replace = <T extends { id: string }>(list: T[], value: T) => {
      const i = list.findIndex((item) => item.id === value.id);
      if (i < 0) list.push(value);
      else list[i] = value;
    };
    const r = structuredClone(action.resource);
    r.value.name = r.value.name.trim();
    switch (r.kind) {
      case "models":
        replace(settings.models, r.value);
        break;
      case "credentials":
        replace(settings.credentials, r.value);
        break;
      case "profiles":
        replace(settings.profiles, r.value);
        break;
      case "harnesses":
        replace(settings.harnesses, r.value);
        break;
    }
  }
  validateSettings(settings);
  return settings;
}
function validateSettings(state: Settings) {
  for (const list of [
    state.models,
    state.credentials,
    state.harnesses,
    state.profiles,
  ]) {
    if (
      list.some((x) => !x.name.trim()) ||
      new Set(list.map((x) => x.name.trim())).size !== list.length
    )
      throw Error("名称必须填写，且同类资源中不能重名。");
  }
  if (state.credentials.some((c) => !/^[A-Z_][A-Z0-9_]*$/.test(c.env)))
    throw Error("凭据只接受环境变量名，例如 TEAM_MODEL_KEY。");
  if (
    state.models.some(
      (m) =>
        !m.model.trim() ||
        !m.provider.trim() ||
        !state.credentials.some((c) => c.id === m.credentialId),
    )
  )
    throw Error("请补齐模型 ID、提供方和凭据引用。");
  for (const p of state.profiles) resolveConfiguration(state, "", p.id);
  resolveConfiguration(state, "", "");
  for (const project of Object.keys(state.projects))
    resolveConfiguration(state, project, "");
}
