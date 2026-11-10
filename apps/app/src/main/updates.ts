import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Updater } from "electrobun/bun";
import type { StudioUpdate, UpdateCommand } from "../shared/updates.ts";

type NativeUpdater = Pick<
  typeof Updater,
  | "checkForUpdate"
  | "downloadUpdate"
  | "applyUpdate"
  | "updateInfo"
  | "appDataFolder"
  | "onStatusChange"
  | "clearStatusHistory"
>;
type PublishedUpdate = {
  version: string;
  hash: string;
  archiveSha256: string;
  notes?: string;
};
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?$/;
const platform = { darwin: "macos", win32: "win", linux: "linux" }[
  process.platform as "darwin" | "win32" | "linux"
];

function readPublished(
  info: unknown,
  current: string,
): PublishedUpdate | undefined {
  if (!info || typeof info !== "object") throw Error("更新清单不可用。");
  const data = info as Record<string, unknown>;
  if (data.error) throw Error("无法读取稳定版更新，请检查网络后重试。");
  if (
    typeof data.version !== "string" ||
    !versionPattern.test(data.version) ||
    data.platform !== platform ||
    data.arch !== process.arch
  )
    throw Error("更新清单与本机平台或稳定渠道不匹配。");
  if (
    data.version
      .split("+")[0]
      .localeCompare(current.split("+")[0], "en", { numeric: true }) <= 0
  )
    return;
  if (
    typeof data.hash !== "string" ||
    !/^[a-z0-9]{1,32}$/.test(data.hash) ||
    typeof data.archiveSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.archiveSha256)
  )
    throw Error("此版本缺少有效的更新校验信息，可从发行页手动安装。");
  return {
    version: data.version,
    hash: data.hash,
    archiveSha256: data.archiveSha256,
    notes: typeof data.notes === "string" ? data.notes : undefined,
  };
}

export function createStudioUpdater(
  sdk: NativeUpdater,
  local: { version: string; channel: string },
  directory: string,
  notify: () => void,
  restartBlocker: () => string | undefined | Promise<string | undefined>,
  mockMode: () => boolean = () => false,
) {
  const state: StudioUpdate = {
    current: local.version,
    phase: local.channel === "stable" ? "idle" : "disabled",
  };
  if (state.phase === "disabled") state.message = "开发构建不接收稳定版更新。";
  const receipt = join(directory, "studio-update.json");
  let returnRoute = "";
  let resumeMock = false;
  if (existsSync(receipt)) {
    const pending = JSON.parse(readFileSync(receipt, "utf8"));
    resumeMock = pending.mock === true;
    if (typeof pending.route === "string" && pending.route.startsWith("#/"))
      returnRoute = pending.route;
    state.result =
      pending.version === local.version
        ? `已更新至 Studio ${local.version}。`
        : `上次更新未完成，当前仍为 ${local.version}。`;
    rmSync(receipt);
  }
  let target: PublishedUpdate | undefined;
  let operation: "check" | "download" | "apply" | undefined;
  let matched = false;
  const changedRelease = "稳定版已变更，请重新检查更新。";
  sdk.onStatusChange(({ status, details }) => {
    if (operation !== "download" && operation !== "apply") return;
    // Electrobun reads Latest again in both downloadUpdate and applyUpdate.
    if (status === "checking") matched = false;
    if (status === "update-available" || status === "no-update") {
      const found = readPublished(sdk.updateInfo(), local.version);
      matched =
        !!found &&
        found.version === target?.version &&
        found.hash === target.hash &&
        found.archiveSha256 === target.archiveSha256;
      if (!matched) throw Error(changedRelease);
    }
    if (
      ["checking-local-tar", "download-complete", "extracting"].includes(
        status,
      ) &&
      !matched
    )
      throw Error(changedRelease);
    if (status === "extracting" && details?.latestHash !== target?.hash)
      throw Error(changedRelease);
    if (
      status === "download-progress" &&
      state.progress !== details?.progress
    ) {
      state.progress = details?.progress;
      notify();
    }
  });

  async function run(action: "check" | "download" | "apply", route: string) {
    operation = action;
    sdk.clearStatusHistory();
    delete state.message;
    delete state.progress;
    try {
      if (action === "check") {
        state.phase = "checking";
        target = undefined;
        delete state.target;
        delete state.notes;
        notify();
        target = readPublished(await sdk.checkForUpdate(), local.version);
        state.phase = target ? "available" : "current";
        state.target = target?.version;
        state.notes = target?.notes;
      } else if (action === "download" && target) {
        state.phase = "downloading";
        notify();
        const archive = join(
          await sdk.appDataFolder(),
          "self-extraction",
          target.hash + ".tar",
        );
        try {
          await sdk.downloadUpdate();
          if (
            !matched ||
            !sdk.updateInfo()?.updateReady ||
            sdk.updateInfo().error
          )
            throw Error("下载未完成，请重新检查后下载。");
          state.phase = "verifying";
          notify();
          const hash = createHash("sha256");
          for await (const bytes of createReadStream(archive))
            hash.update(bytes);
          if (hash.digest("hex") !== target.archiveSha256)
            throw Error("更新包校验失败，请重新下载。");
          state.phase = "ready";
        } catch (error) {
          rmSync(archive, { force: true });
          throw error;
        }
      } else if (action === "apply" && target) {
        const reason = await restartBlocker();
        if (reason) {
          state.message = reason;
          return;
        }
        state.phase = "applying";
        notify();
        writeFileSync(
          receipt + ".tmp",
          JSON.stringify({ version: target.version, route, mock: mockMode() }),
          { mode: 0o600 },
        );
        renameSync(receipt + ".tmp", receipt);
        await sdk.applyUpdate();
        // A successful native handoff quits Studio. An early return means it failed.
        throw Error("未能重启并安装更新，请重新检查或使用发行页的安装包。");
      }
    } catch (error) {
      if (action === "apply") rmSync(receipt, { force: true });
      state.phase = "failed";
      state.message =
        error instanceof Error ? error.message : "更新未完成，请重试。";
    } finally {
      operation = undefined;
      notify();
    }
  }
  return {
    state,
    returnRoute,
    resumeMock,
    start(command: Exclude<UpdateCommand, { action: "release" }>) {
      if (state.phase === "disabled" || operation === command.action) return;
      if (operation) throw Error("正在处理上一项更新操作，请稍后重试。");
      if (command.action === "check") return run("check", "");
      if (
        command.action === "download" &&
        target &&
        (state.phase === "available" || state.phase === "failed")
      )
        return run("download", "");
      if (command.action === "apply" && state.phase === "ready") {
        if (
          typeof command.route !== "string" ||
          !command.route.startsWith("#/")
        )
          throw Error("无效的返回页面。");
        return run("apply", command.route);
      }
    },
  };
}
