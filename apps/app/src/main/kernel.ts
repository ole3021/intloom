import { object, packageInfo, row } from "./projections.ts";
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { ServiceStatus } from "@intloom/cli/local-service";
import type {
  ArtifactRecord,
  Page,
  RunSummary,
  RunEvent,
} from "@intloom/loom-sdk";
import type {
  Action,
  ActionResult,
  PackageInfo,
  LoomInstallPreview,
  RunDetail,
  RunListItem,
  RunQuery,
  Settings,
  Snapshot,
} from "../shared/types";

import { noRelease, resolveInstallSource } from "./install-source.ts";

const exec = promisify(execFile);
const npmName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
async function pages<T>(
  read: (page: { limit: number; cursor?: string }) => Promise<Page<T>>,
) {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await read({ limit: 100, ...(cursor && { cursor }) });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}
function errorCode(e: unknown) {
  return (e as { code?: string })?.code;
}
export async function kernelBackend(
  directory: string,
  changed: () => void,
  runtime: string,
  dataDir = join(homedir(), ".intloom"),
) {
  const node = join(
    runtime,
    "bin",
    process.platform === "win32" ? "node.exe" : "node",
  );
  const host: typeof import("@intloom/cli/local-service") = await import(
    pathToFileURL(
      join(runtime, "node_modules/@intloom/cli/dist/local-service.js"),
    ).href
  );
  const targetVersion: string = JSON.parse(
    readFileSync(
      join(runtime, "node_modules/@intloom/kernel/package.json"),
      "utf8",
    ),
  ).version;
  const client = host.createServiceClient(dataDir);
  const config = join(dataDir, "intloom.yaml");
  const prefsFile = join(directory, "studio-prefs.json"),
    cacheFile = join(directory, "recent-runs.json");
  const prefs: Settings = {
    theme: "system",
    reduceMotion: false,
    notifications: true,
    models: [],
    credentials: [],
    harnesses: [],
    profiles: [],
    globalProfile: "",
    projects: {},
  };
  if (existsSync(prefsFile))
    Object.assign(prefs, JSON.parse(readFileSync(prefsFile, "utf8")));
  let cache: { syncedAt?: string; runs: RunListItem[] } = existsSync(cacheFile)
    ? JSON.parse(readFileSync(cacheFile, "utf8"))
    : { runs: [] };
  const write = (file: string, value: unknown) => {
    writeFileSync(file + ".tmp", JSON.stringify(value), { mode: 0o600 });
    renameSync(file + ".tmp", file);
  };
  let catalog: PackageInfo[] = [],
    catalogKey = "",
    observation = "";
  function status() {
    return client("serviceStatus");
  }
  function compatible(s: ServiceStatus) {
    if (s.kernelVersion !== targetVersion)
      throw Error(
        `共享 Kernel ${s.kernelVersion ?? s.version}，Studio 需要 ${targetVersion}。`,
      );
    return s;
  }
  async function manage(
    op: "start" | "install" | "remove" | "preview",
    s?: ServiceStatus,
    source?: string,
    integrity?: string,
  ) {
    let prefix: string | undefined;
    if (s?.npmGlobalRoot)
      prefix =
        process.platform === "win32"
          ? dirname(s.npmGlobalRoot)
          : resolve(s.npmGlobalRoot, "../..");
    if (!prefix) {
      try {
        prefix = (await exec("npm", ["prefix", "-g"])).stdout.trim();
      } catch {
        const builtIn = (
          await exec(
            node,
            [join(runtime, "node_modules/npm/bin/npm-cli.js"), "prefix", "-g"],
            { cwd: homedir() },
          )
        ).stdout.trim();
        prefix =
          resolve(builtIn) === resolve(runtime) ||
          resolve(builtIn) === dirname(node)
            ? join(dataDir, "npm")
            : builtIn;
      }
    }
    const env = {
      ...process.env,
      PATH: join(runtime, "bin") + delimiter + (process.env.PATH ?? ""),
      npm_config_prefix: prefix,
      INTLOOM_NPM_CLI: join(runtime, "node_modules/npm/bin/npm-cli.js"),
    };
    return await exec(
      node,
      [
        join(runtime, "manage-service.mjs"),
        op,
        dataDir,
        ...(source ? [source] : []),
        ...(integrity ? [integrity] : []),
      ],
      { env, cwd: homedir() },
    ).catch((e) => {
      // Only return the actionable error. Child stderr may contain npm script output.
      const line = String(e.stderr)
        .split("\n")
        .find((x) => /^(?:IntloomError|Error): /.test(x));
      throw Error(
        line?.split("Command failed:")[0].trim() ||
          "本机服务操作失败，请检查 npm 配置和服务日志。",
      );
    });
  }
  let starting: Promise<ServiceStatus> | undefined;
  let upgradeEndpoint: string | undefined;
  let startupIssue: string | undefined;
  function ensure(): Promise<ServiceStatus> {
    if (starting) return starting;
    startupIssue = undefined;
    starting = (async () => {
      let current: ServiceStatus | undefined;
      try {
        current = await status();
      } catch (e) {
        if (errorCode(e) !== "SERVICE_NOT_RUNNING") throw e;
      }
      if (current?.kernelVersion === targetVersion) return compatible(current);
      upgradeEndpoint = current?.endpoint;
      await manage("start", current);
      return compatible(await status());
    })()
      .catch((error: unknown) => {
        startupIssue = String(error);
        throw error;
      })
      .finally(() => {
        starting = undefined;
      });
    return starting;
  }
  async function previewLoom(input: string): Promise<LoomInstallPreview[]> {
    const sources = await resolveInstallSource(input);
    const service = await status().catch((e) => {
      if (errorCode(e) !== "SERVICE_NOT_RUNNING") throw e;
      return undefined;
    });
    const candidates: LoomInstallPreview[] = [];
    for (const source of sources) {
      const result = await manage("preview", service, source.spec);
      const pkg = JSON.parse(result.stdout) as Omit<
        LoomInstallPreview,
        "spec" | "sourceLabel"
      > | null;
      if (!pkg) continue;
      const spec =
        source.kind === "npm" ? pkg.id + "@" + pkg.version : source.spec;
      candidates.push({ ...pkg, spec, sourceLabel: source.label });
    }
    if (!candidates.length)
      throw Error(
        sources[0]?.kind === "github"
          ? noRelease
          : "这个包不是已构建的 Loom，请检查安装来源。",
      );
    return candidates;
  }
  async function listItem(s: RunSummary) {
    const item = row(s);
    if (s.pendingInteractionIds.length) {
      const requests = await Promise.all(
        s.pendingInteractionIds.map((id) => client("getInteraction", [id])),
      );
      item.pending = requests
        .filter((r) => r.request.status === "pending")
        .map(({ request: { id, kind, message, createdAt } }) => ({
          id,
          kind,
          message,
          createdAt,
        }));
      item.message = item.pending[0]?.message ?? item.message;
    }
    return item;
  }
  async function snapshot(): Promise<Snapshot> {
    const base: Snapshot = {
      runs: cache.runs,
      catalog,
      installed: catalog.map((p) => p.ref.id),
      service: "offline",
      settings: prefs,
      connection: { config, syncedAt: cache.syncedAt },
    };
    let s: ServiceStatus;
    try {
      const current = await status();
      s =
        current.kernelVersion !== targetVersion &&
        current.endpoint !== upgradeEndpoint
          ? await ensure()
          : compatible(current);
      startupIssue = undefined;
    } catch (e) {
      if (startupIssue || errorCode(e) !== "SERVICE_NOT_RUNNING")
        base.connection = {
          ...base.connection,
          config,
          issue: startupIssue ?? String(e),
        };
      return base;
    }
    if (s.status === "closing") return { ...base, service: "stopping" };
    const issues = s.storageIssues.map((issue) => issue.message);
    let catalogIssue: string | undefined;
    const refreshCatalog = async () => {
      if (!s.npmGlobalRoot) throw Error("当前服务无法读取 npm 全局目录。");
      const looms = await pages((p) => client("listLooms", [p]));
      const key = JSON.stringify(looms.map((l) => l.ref));
      if (key === catalogKey) return;
      catalog = await Promise.all(
        looms.map(async (l) =>
          packageInfo(l.ref.id, await client("getLoom", [{ id: l.ref.id }])),
        ),
      );
      catalogKey = key;
    };
    const [active, overview] = await Promise.all([
      pages((p) => client("listUnfinishedRuns", [p])),
      client("getRunOverview"),
      refreshCatalog().catch((e) => {
        catalogIssue = "读取 Loom 库失败 · " + String(e);
        issues.push(catalogIssue);
        catalogKey = "";
      }),
    ]);
    const runs = await Promise.all(
      [
        ...new Map(
          [...active, ...overview.recent].map((r) => [r.id, r]),
        ).values(),
      ].map(listItem),
    );
    const cached = runs.slice(0, 24).map(({ summary }) =>
      row({
        id: summary.id,
        loom: summary.loom,
        location: summary.location,
        status: summary.status,
        parentRunId: summary.parentRunId,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        startedAt: summary.startedAt,
        finishedAt: summary.finishedAt,
        command: summary.command,
        harness: summary.harness,
        waits: [],
        pendingInteractionIds: [],
      }),
    );
    if (
      !cache.syncedAt ||
      JSON.stringify(cache.runs) !== JSON.stringify(cached)
    ) {
      cache = { syncedAt: new Date().toISOString(), runs: cached };
      write(cacheFile, cache);
    }
    return {
      service: "online",
      settings: prefs,
      runs,
      catalog,
      installed: catalog.map((l) => l.ref.id),
      connection: {
        config,
        version: s.kernelVersion ?? s.version,
        npmRoot: s.npmGlobalRoot,
        catalogIssue,
        mcpUrl: s.mcpUrl,
        syncedAt: cache.syncedAt,
        issue: issues.join("\n"),
      },
    };
  }
  let observedEvents: { runId: string; events: RunEvent[] } | undefined;
  async function getRun(id: string): Promise<RunDetail | null> {
    try {
      const activity = await client("getRunActivity", [id]),
        run = activity.run;
      const [result, requests, own, direct] = await Promise.all([
        client("getRunResult", [id]),
        client("listInteractions", [{ runId: id, status: "pending" }]),
        client("listInteractions", [{ runId: id }]),
        pages((p) => client("listRuns", [{ ...p, parentRunId: id }])),
      ]);
      const children = [...direct];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        children.push(
          ...(await pages((p) =>
            client("listRuns", [{ ...p, parentRunId: child.id }]),
          )),
        );
      }
      let events = observedEvents?.runId === id ? observedEvents.events : [];
      let after = events.at(-1)?.seq ?? 0;
      while (after < activity.throughSeq) {
        const p = await client("listRunEvents", [
          { runId: id, after, limit: 100 },
        ]);
        if (!p.items.length) break;
        events = events.concat(p.items);
        after = p.items.at(-1)!.seq;
      }
      observedEvents = { runId: id, events };
      const refs = new Map<string, boolean>();
      for (const ref of Object.values(result.outcome?.deliveries ?? {}).flat())
        refs.set(ref.id, true);
      if (
        object(result.output) &&
        result.output.kind === "artifact" &&
        typeof result.output.id === "string" &&
        run.status === "succeeded" &&
        result.deliveryStatus !== "rejected"
      )
        refs.set(result.output.id, true);
      if (result.candidate && !refs.has(result.candidate.id))
        refs.set(result.candidate.id, result.deliveryStatus === "approved");
      const files = await Promise.all(
        [...refs].map(async ([fid, delivered]) => ({
          record: await client("getArtifact", [fid]),
          delivered,
        })),
      );
      const reviews = await Promise.all(
        requests.map(async (request) => {
          const ref = object(request.context)
            ? request.context.candidate
            : undefined;
          const candidate =
            object(ref) && ref.kind === "artifact" && typeof ref.id === "string"
              ? await client("getArtifact", [ref.id])
              : undefined;
          return {
            request,
            title: request.runId === id ? run.loom.id : request.runId,
            candidate,
          };
        }),
      );
      const answers = (
        await Promise.all(
          own
            .filter((r) => r.answerResponseId)
            .map((q) => client("getInteraction", [q.id])),
        )
      ).flatMap((i) => i.responses);
      let since = run.startedAt ?? run.createdAt,
        workMs = 0,
        waitMs = 0,
        ticking: RunDetail["durations"]["ticking"] = "stopped";
      for (const e of events) {
        const next =
          e.type === "run.waiting"
            ? "wait"
            : ["run.started", "run.resumed", "run.stopping"].includes(e.type)
              ? "work"
              : [
                    "run.succeeded",
                    "run.failed",
                    "run.cancelled",
                    "run.interrupted",
                  ].includes(e.type)
                ? "stopped"
                : undefined;
        if (!next) continue;
        const ms = Date.parse(e.time) - Date.parse(since);
        if (ticking === "work") workMs += ms;
        if (ticking === "wait") waitMs += ms;
        since = e.time;
        ticking = next;
      }
      const acceptance = result.acceptance
        ? await client("getAcceptance", [result.acceptance.id])
        : undefined;
      return {
        ...row(run),
        acceptance,
        retryLoom: run.loom.id,
        activity,
        events,
        answers,
        children: children.map(row),
        reviews,
        files,
        output: result.output,
        delivered: files.some((f) => f.delivered),
        durations: { since, workMs, waitMs, ticking },
      };
    } catch (e) {
      if (errorCode(e) === "RUN_NOT_FOUND") return null;
      throw e;
    }
  }
  async function act(a: Action): Promise<ActionResult> {
    if (a.type === "preferences") {
      const { theme, reduceMotion, notifications } = a.patch;
      Object.assign(prefs, {
        theme: theme ?? prefs.theme,
        reduceMotion: reduceMotion ?? prefs.reduceMotion,
        notifications: notifications ?? prefs.notifications,
      });
      write(prefsFile, {
        theme: prefs.theme,
        reduceMotion: prefs.reduceMotion,
        notifications: prefs.notifications,
      });
      return {};
    }
    if (a.type === "service") {
      if (a.online) await ensure();
      else await client("serviceShutdown");
      return {};
    }
    if (a.type === "catalog") {
      const s = await ensure();
      if (!s.npmGlobalRoot) throw Error("当前服务无法读取 npm 全局目录。");
      const source = a.id.trim();
      if (a.install) {
        const sources = await resolveInstallSource(source);
        if (sources.length !== 1) throw Error("请在预览中选择一个 Loom。");
        await manage("install", s, sources[0].spec, a.integrity);
      } else {
        if (!npmName.test(source) || !catalog.some((l) => l.ref.id === source))
          throw Error("该 Loom 未安装。");
        await manage("remove", s, source);
      }
      catalogKey = "";
      return {};
    }
    if (a.type === "launch") {
      await ensure();
      const d = a.draft;
      const loom = await client("getLoom", [
        { id: d.loom, command: d.command },
      ]);
      const scoped = host.createServiceClient(
        dataDir,
        d.projectDir || undefined,
      );
      const run = await scoped("createRun", [
        {
          loom: loom.ref,
          input: a.jsonInput ?? d.input,
          confirmDelivery: d.finalConfirmation,
        },
      ]);
      try {
        return { receipt: await client("startRun", [run.id]) };
      } catch (e) {
        return {
          createdId: run.id,
          issue: `Run ${run.id} 启动时出错。 ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }
    if (a.type === "cancel")
      return { receipt: await client("cancelRun", [a.id]) };
    if (a.type === "resume")
      return {
        receipt: await client("resumeRun", [
          a.requestId
            ? { runId: a.id, requestId: a.requestId }
            : {
                runId: a.id,
                waitId: a.waitId,
                ...(a.resumeData !== undefined && { resumeData: a.resumeData }),
              },
        ]),
      };
    if (a.type === "answer") {
      const { request } = await client("getInteraction", [a.requestId]);
      const value =
        request.kind === "approval"
          ? { approved: a.value }
          : request.answerSchema.type === "string"
            ? a.value
            : JSON.parse(String(a.value));
      return {
        interaction: await client("respondInteraction", [
          a.requestId,
          { action: "submit", value },
          {
            source: {
              kind:
                process.env.INTLOOM_STUDIO_TEST_ACTOR === "1"
                  ? "test"
                  : "human",
              via: "api",
            },
          },
        ]),
      };
    }
    throw Error("当前服务不支持此操作。");
  }
  async function listRuns(q: RunQuery) {
    if (
      (await status().catch((e) => {
        if (errorCode(e) === "SERVICE_NOT_RUNNING") return undefined;
        throw e;
      })) === undefined
    ) {
      return {
        items: cache.runs
          .filter(
            (r) =>
              (!q.query || r.summary.id === q.query) &&
              (!q.loom || r.summary.loom.id === q.loom) &&
              (!q.status ||
                q.status === "all" ||
                r.summary.status === q.status),
          )
          .slice(0, q.limit ?? 30),
      };
    }
    if (q.query) {
      try {
        const r = await client("getRun", [q.query.trim()]);
        const match =
          (!q.loom || r.loom.id === q.loom) &&
          (!q.status || q.status === "all" || r.status === q.status);
        return { items: match ? [await listItem(r)] : [] };
      } catch (e) {
        if (["RUN_NOT_FOUND", "INVALID_ARGUMENT"].includes(errorCode(e) ?? ""))
          return { items: [] };
        throw e;
      }
    }
    const page = await client("listRuns", [
      {
        ...(q.loom && { loom: { id: q.loom } }),
        ...(q.status &&
          q.status !== "all" && { status: q.status as RunSummary["status"] }),
        ...(q.cursor && { cursor: q.cursor }),
        limit: q.limit ?? 30,
      },
    ]);
    return { ...page, items: await Promise.all(page.items.map(listItem)) };
  }
  async function artifact(id: string, folder?: string) {
    const record: ArtifactRecord = await client("getArtifact", [id]);
    if (!folder) {
      const previews = join(directory, "previews");
      mkdirSync(previews, { recursive: true });
      folder = await mkdtemp(join(previews, "open-"));
    }
    const { path } = await client("exportArtifact", [
      { artifactId: id, path: join(folder, basename(record.name)) },
    ]);
    return path;
  }
  async function tick() {
    let key: string;
    try {
      const s = await status();
      key = JSON.stringify([s.endpoint, s.status, s.runRevision]);
    } catch (e) {
      key = String(e);
    }
    if (key !== observation) {
      observation = key;
      changed();
    }
  }
  return {
    ensure,
    previewLoom,
    snapshot,
    getRun,
    listRuns,
    act,
    artifact,
    tick,
    configuration: (projectDir?: string) =>
      client("describeConfiguration", [projectDir]),
  };
}
