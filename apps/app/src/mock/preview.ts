import { mockInstallPreview } from "./install.ts";
import { overview, listRuns, getRun } from "./queries.ts";
import { candidateReady } from "./lifecycle.ts";
import { MockService, createSeed } from "./service.ts";
import type { DesktopApi } from "../shared/types.ts";
import manifest from "../../package.json";
// Only used by Vite's browser preview. The native build talks exclusively to its Bun host.
export function preview(): DesktopApi {
  const service = new MockService(createSeed()),
    listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of listeners) fn();
  };
  function finishCandidates() {
    for (const r of service.state.runs)
      if (r.stage === "preparing") candidateReady(r, new Date().toISOString());
  }
  finishCandidates();
  setInterval(() => {
    if (service.tick()) {
      finishCandidates();
      notify();
    }
  }, 400);
  return {
    previewLoom: async (source: string) =>
      mockInstallPreview(source, service.state.installed),
    snapshot: async () => ({
      ...structuredClone(overview(service.state)),
      update: {
        current: manifest.version,
        phase: "disabled",
        message: "在已安装的 Studio 稳定版中可检查更新。",
      },
    }),
    update: async () => {
      throw Error("请在桌面 App 中检查更新。");
    },
    getRun: async (id) => structuredClone(getRun(service.state, id)),
    listRuns: async (q) => structuredClone(listRuns(service.state, q)),
    act: async (action) => {
      const receipt = service.apply(action);
      notify();
      return receipt;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    pick: async () => {
      throw Error("系统选择器可在桌面 App 中使用；浏览器预览可选用示例素材。");
    },
    artifact: async () => {
      throw Error("请在桌面 App 中打开或导出交付文件。");
    },
  };
}
