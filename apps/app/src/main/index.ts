import Electrobun, {
  BrowserView,
  BrowserWindow,
  Utils,
  ApplicationMenu,
  Updater,
} from "electrobun/bun";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StudioRPC } from "../shared/rpc";
import type { Snapshot } from "../shared/types";
import { createStudioUpdater } from "./updates";
import { blocksStudioRestart } from "../shared/updates";
import { mockBackend } from "./mock";
import { kernelBackend } from "./kernel";

let win: BrowserWindow | null = null;
let focused = false;
let backgroundRequest: { id: string; requestId: string } | undefined;
let last: Snapshot | undefined;
let seen: Set<string> | undefined;
function changed() {
  if (win) rpc.send.changed({});
}
async function snapshot() {
  const data = await backend.snapshot();
  const pending = new Set<string>();
  for (const r of data.runs)
    for (const q of r.pending) {
      pending.add(q.id);
      if (
        !seen ||
        seen.has(q.id) ||
        !data.settings.notifications ||
        focused ||
        data.service !== "online"
      )
        continue;
      backgroundRequest = { id: r.summary.id, requestId: q.id };
      const fallback = () =>
        Utils.showNotification({
          title: r.title,
          body: q.message + " · 在运行中心查看",
          silent: true,
        });
      if (win)
        void rpc.request
          .notify({ ...backgroundRequest, title: r.title, body: q.message })
          .then((shown) => {
            if (!shown) fallback();
          }, fallback);
      else fallback();
    }
  seen = pending;
  last = data;
  return data;
}
const updates = createStudioUpdater(
  Updater,
  await Updater.getLocalInfo(),
  Utils.paths.userData,
  changed,
  async () => {
    const current = await backend.snapshot();
    if (current.service === "offline" && current.connection?.issue)
      return "暂时无法确认本机服务状态，请在服务管理中核对后重试。";
    if (current.service === "offline" && !current.mock) return;
    const runs = current.runs.filter(blocksStudioRestart);
    if (runs.length)
      return "请先处理以下运行：" + runs.map((r) => r.title).join("、");
  },
  () => mock,
);
const mock: boolean =
  process.argv.includes("--mock") ||
  process.env.INTLOOM_STUDIO_MODE === "mock" ||
  updates.resumeMock;
const directory =
  (mock
    ? process.env.INTLOOM_STUDIO_MOCK_DIR
    : process.env.INTLOOM_STUDIO_DATA_DIR) || Utils.paths.userData;
mkdirSync(directory, { recursive: true });
const backend = mock
  ? mockBackend(directory, changed)
  : await kernelBackend(
      directory,
      changed,
      join(import.meta.dir, "runtime"),
      process.env.INTLOOM_STUDIO_SMOKE === "1"
        ? process.env.INTLOOM_DATA_DIR
        : undefined,
    );
if ("ensure" in backend) await backend.ensure().catch(() => undefined);
let returnRoute = updates.returnRoute;
let initialRoute = "";
const rpc = BrowserView.defineRPC<StudioRPC>({
  maxRequestTime: Infinity,
  handlers: {
    requests: {
      previewLoom: ({ source }) => backend.previewLoom(source),
      configuration: ({ projectDir }) => {
        if (!("configuration" in backend)) throw Error("当前为演练模式。");
        return backend.configuration(projectDir);
      },
      initialRoute: () => initialRoute,
      snapshot: async () => {
        const data = await snapshot();
        if (
          process.env.INTLOOM_STUDIO_SMOKE === "1" &&
          (mock
            ? process.env.INTLOOM_STUDIO_MOCK_DIR
            : process.env.INTLOOM_STUDIO_DATA_DIR)
        )
          writeFileSync(
            join(directory, "view-ready.json"),
            JSON.stringify({ ready: true, mode: mock ? "mock" : "kernel" }),
          );
        return { ...data, update: updates.state };
      },
      update: (command) => {
        if (command.action === "release") {
          const path = updates.state.target
            ? "tag/app-v" + encodeURIComponent(updates.state.target)
            : "latest";
          if (
            !Utils.openExternal(
              "https://github.com/ole3021/intloom/releases/" + path,
            )
          )
            throw Error("无法打开发行页。");
        } else updates.start(command);
      },
      listRuns: (query) => backend.listRuns(query),
      getRun: ({ id }) => backend.getRun(id),
      act: async (action) => {
        if (updates.state.phase === "applying")
          throw Error("Studio 正在重启更新。");
        try {
          return await backend.act(action);
        } finally {
          changed();
        }
      },
      pick: async ({ kind }) =>
        (
          await Utils.openFileDialog({
            canChooseDirectory: kind === "directory",
            canChooseFiles: kind !== "directory",
            allowsMultipleSelection: kind === "files",
          })
        ).filter(Boolean),
      artifact: async ({ id, mode }) => {
        if (mode === "open") {
          const editable = await backend.artifact(id);
          if (!Utils.openPath(editable)) throw Error("系统无法打开文件。");
          return editable;
        }
        const [folder] = await Utils.openFileDialog({
          canChooseDirectory: true,
          canChooseFiles: false,
          allowsMultipleSelection: false,
        });
        if (!folder) return "";
        return backend.artifact(id, folder);
      },
    },
  },
});
function show(about = false) {
  if (win) {
    win.show();
    if (about)
      win.webview.executeJavascript(
        'window.dispatchEvent(new Event("studio-about"))',
      );
    return;
  }
  initialRoute = about
    ? "#/about"
    : returnRoute ||
      (backgroundRequest &&
      last?.runs.some((run) =>
        run.pending.some(
          (request) => request.id === backgroundRequest?.requestId,
        ),
      )
        ? `#/run/${encodeURIComponent(backgroundRequest.id)}?request=${encodeURIComponent(backgroundRequest.requestId)}`
        : "");
  returnRoute = "";
  backgroundRequest = undefined;
  const w = new BrowserWindow({
    title: "IntLoom Studio",
    url: "views://studio/index.html",
    frame: { x: 120, y: 80, width: 1180, height: 780 },
    rpc,
  });
  win = w;
  focused = true;
  w.on("focus", () => {
    focused = true;
  });
  w.on("blur", () => {
    focused = false;
  });
  w.on("close", () => {
    focused = false;
    win = null;
  });
}
ApplicationMenu.setApplicationMenu([
  {
    label: "IntLoom Studio",
    submenu: [
      { label: "关于 Studio", action: "about" },
      { label: "显示工作台", action: "show" },
      { role: "quit" },
    ],
  },
  {
    label: "编辑",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
]);
ApplicationMenu.on("application-menu-clicked", (e) => {
  const action = (e as { data: { action: string } }).data.action;
  if (action === "show" || action === "about") show(action === "about");
});
Electrobun.events.on("reopen", () => show());
show();
updates.start({ action: "check" });
async function observe() {
  try {
    if (updates.state.phase !== "applying") {
      await backend.tick();
      if (!win) await snapshot();
    }
  } finally {
    setTimeout(() => void observe(), mock ? 400 : 1500);
  }
}
void observe();
