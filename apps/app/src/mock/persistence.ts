import type { MockState } from "./state.ts";
export function loadState(json: string): MockState {
  const saved = JSON.parse(json) as Omit<MockState, "schemaVersion"> & {
    schemaVersion: number;
  };
  if (saved.schemaVersion === 1) {
    for (const [id, demo] of [
      ["ppt-generator", "demo-presentation"],
      ["photo-editor", "demo-photo"],
    ]) {
      if (saved.installed.includes(id)) saved.installed.push(demo);
    }
    for (const r of saved.runs) {
      if (r.artifact)
        r.artifact = {
          ...r.artifact,
          digest: r.artifact.digest.replace(/^sha256:/, ""),
        };
    }
  } else if (saved.schemaVersion !== 2)
    throw Error("不支持的 Studio 模拟数据版本。");
  return { ...saved, schemaVersion: 2 };
}
