import {
  decodeCheckpoint,
  encodeCheckpoint,
} from "../runtime/recovery/codec.ts";
import {
  lstat,
  open,
  realpath,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  rmdir,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { LoomError } from "@intloom/utils";
import {
  checkpointSnapshotSchema,
  type CheckpointSnapshot,
} from "../runtime/recovery/contracts.ts";
import { openRunCheckpointStore } from "../host/checkpoints/store.ts";
import type { StorageHandle } from "../storage/contracts.ts";
import { storageSnapshotSchema } from "../storage/snapshot.ts";
import { openFileStorage } from "../storage/file/open.ts";
import { openSqliteStorage } from "../storage/sqlite/open.ts";
import {
  manifestSchema,
  digest,
  type MirrorManifest,
  type MirrorControl,
  type MirrorScope,
} from "./contracts.ts";
import { jsonCopy } from "../shared/json.ts";
import {
  copyFiles,
  isMissing,
  exists,
  filesSchema,
  inside,
  readBytes,
  safePath,
  scanFiles,
  validateFilePaths,
  verifyFiles,
  writeBytes,
  type MirrorFileOptions,
} from "./files.ts";
import { createWriteGate } from "./write-gate.ts";
import { getLogger } from "@intloom/utils";

const names = [
  "mirror.json",
  "checkpoint.json",
  "storage.json",
  "files.json",
] as const;
async function writeJson(
  root: string,
  name: string,
  value: unknown,
  onCreated?: (path: string) => void | Promise<void>,
): Promise<string> {
  const text = JSON.stringify(jsonCopy(value));
  await writeBytes(root, name, Buffer.from(text), false, onCreated);
  return digest(text);
}
export function mirrorRoot(project: string): string {
  return join(project, ".intloom/mirrors/runs");
}
function boundaryPath(
  manifest: Pick<MirrorManifest, "traceId" | "mirrorId" | "boundary">,
): string {
  const b = manifest.boundary;
  const label = (name: string | undefined) =>
    (name ?? "unknown").replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 100);
  const stage = `stages/${String(b.stageVisitId).padStart(4, "0")}-${label(b.stageName)}`;
  const step = `${stage}/steps/${String(b.stepVisitId).padStart(4, "0")}-${label(b.stepName)}`;
  const path = b.kind.startsWith("loom_")
    ? `loom/${b.kind === "loom_start" ? "start" : "end"}`
    : b.kind.startsWith("step_")
      ? `${step}/${b.kind === "step_before" ? "before" : "after"}`
      : `${stage}/${b.kind === "stage_before_init" ? "before-init" : b.kind === "stage_start" ? "start" : "end"}`;
  return `${manifest.traceId}/${path}/${manifest.mirrorId}`;
}
export function createMirrorCoordinator(
  project: string,
  storage: StorageHandle,
  files: MirrorFileOptions,
) {
  if (
    !storage.exportSnapshot ||
    !storage.importSnapshot ||
    !storage.backend ||
    !storage.location
  )
    throw new Error("Mirrors require a local Storage snapshot implementation.");
  const exportSnapshot = storage.exportSnapshot;
  const gate = createWriteGate();
  return {
    gate,
    assertOpen: gate.assertOpen,
    async capture(
      checkpoint: CheckpointSnapshot,
      pending: NonNullable<MirrorControl["capturePending"]>,
      observation: () => {
        metrics?: unknown;
        results?: unknown;
        settled?: boolean;
      } = () => ({}),
    ): Promise<void> {
      // Freeze before any await; this copy is the safe-boundary control truth.
      const fixed = checkpointSnapshotSchema.parse(jsonCopy(checkpoint));
      await gate.capture(async () => {
        const started = performance.now();
        const root = mirrorRoot(project);
        await safePath(project, ".intloom/mirrors/runs");
        await mkdir(root, { recursive: true, mode: 0o700 });
        const identity = {
          traceId: fixed.control?.traceId ?? "",
          mirrorId: pending.mirrorId,
          boundary: pending.boundary,
        };
        const path = boundaryPath(identity);
        const published = await safePath(root, path);
        if (await exists(published)) {
          const saved = await readMirrorDirectory(published);
          if (
            saved.manifest.mirrorId !== pending.mirrorId ||
            saved.manifest.traceId !== fixed.control?.traceId ||
            saved.manifest.runId !== fixed.run.id ||
            !isDeepStrictEqual(saved.manifest.boundary, pending.boundary) ||
            !isDeepStrictEqual(saved.checkpoint.stage, fixed.stage) ||
            !isDeepStrictEqual(saved.checkpoint.result, fixed.result) ||
            !isDeepStrictEqual(
              saved.checkpoint.validatedRoute,
              fixed.validatedRoute,
            ) ||
            !isDeepStrictEqual(saved.checkpoint.run.cursor, fixed.run.cursor) ||
            !isDeepStrictEqual(saved.storage, await exportSnapshot()) ||
            !isDeepStrictEqual(saved.files, await scanFiles(project, files))
          )
            throw new Error(
              "Published mirror identity or business data cannot be overwritten.",
            );
          return;
        }
        const temporary = await mkdtemp(
          join(root, `.tmp-${pending.mirrorId}-`),
        );
        try {
          const snapshot = await exportSnapshot();
          const manifestFiles = await scanFiles(project, files);
          await mkdir(join(temporary, "files"), { mode: 0o700 });
          await copyFiles(project, join(temporary, "files"), manifestFiles);
          await verifyFiles(join(temporary, "files"), manifestFiles);
          const after = await scanFiles(project, files);
          if (!isDeepStrictEqual(after, manifestFiles))
            throw new Error(
              "Project files changed during mirror capture; no image was published.",
            );
          const digests = {
            checkpoint: await writeJson(
              temporary,
              "checkpoint.json",
              encodeCheckpoint(fixed),
            ),
            storage: await writeJson(temporary, "storage.json", snapshot),
            filesManifest: await writeJson(
              temporary,
              "files.json",
              manifestFiles,
            ),
          };
          const meta = observation();
          const terminal = fixed.phase === "terminal";
          const manifest: MirrorManifest = {
            schemaVersion: 1,
            ...identity,
            runId: fixed.run.id,
            capturedAt: new Date().toISOString(),
            source: {
              mirrorId: fixed.control?.sourceMirrorId ?? null,
              traceId: fixed.control?.sourceTraceId ?? null,
            },
            loom: {
              name: fixed.run.loomName,
              identityAtCapture: fixed.loomIdentity,
            },
            storageBackend: storage.backend as "file" | "sqlite",
            complete: true,
            restorable:
              !terminal &&
              ["stage_pending", "step_ready", "step_result"].includes(
                fixed.phase,
              ),
            ...(terminal
              ? { reason: "Terminal images are inspect/export only." }
              : {}),
            consistency: "controlled_writes_settled",
            digests,
            capture: {
              durationMs: performance.now() - started,
              files: manifestFiles.entries.length,
              bytes: manifestFiles.entries.reduce(
                (total, item) => total + (item.type === "file" ? item.size : 0),
                0,
              ),
            },
            ...(meta
              ? {
                  observation: jsonCopy({
                    metrics: meta.metrics,
                    results: meta.results,
                    settled: meta.settled,
                  }) as unknown as import("@intloom/loom-sdk").JsonValue,
                }
              : {}),
            ...(fixed.observationBaseline
              ? { observationBaseline: fixed.observationBaseline }
              : {}),
          };
          await writeJson(temporary, "mirror.json", manifest);
          await readMirrorDirectory(temporary);
          await mkdir(dirname(published), { recursive: true, mode: 0o700 });
          await safePath(root, path);
          if (await exists(published))
            throw new Error(
              "Mirror already published; immutable images cannot be replaced.",
            );
          await rename(temporary, published);
          const publishedParent = await open(dirname(published), "r");
          try {
            await publishedParent.sync();
          } finally {
            await publishedParent.close();
          }
          // run.json is a best-effort index only; list scans immutable manifests.
          try {
            const traceDirectory = join(root, manifest.traceId);
            const index = join(traceDirectory, `.run-${randomUUID()}.tmp`);
            await writeJson(traceDirectory, relative(traceDirectory, index), {
              schemaVersion: 1,
              traceId: manifest.traceId,
              runId: manifest.runId,
              source: manifest.source,
            });
            await rename(index, join(traceDirectory, "run.json"));
          } catch (cause) {
            getLogger().warn("mirror_index_failed", { err: cause });
          }
        } finally {
          await rm(temporary, { recursive: true, force: true });
        }
      });
    },
  };
}
export async function readMirrorDirectory(directory: string) {
  const raw = Object.fromEntries(
    await Promise.all(
      names.map(
        async (name) =>
          [
            name,
            JSON.parse((await readBytes(directory, name)).toString("utf8")),
          ] as const,
      ),
    ),
  );
  const manifest = manifestSchema.parse(raw["mirror.json"]);
  for (const [name, expected] of [
    ["checkpoint.json", manifest.digests.checkpoint],
    ["storage.json", manifest.digests.storage],
    ["files.json", manifest.digests.filesManifest],
  ] as const) {
    if (digest(await readBytes(directory, name)) !== expected)
      throw new Error(`Mirror digest mismatch: ${name}`);
  }
  const checkpoint = decodeCheckpoint(raw["checkpoint.json"]);
  if (
    checkpoint.version !== 3 ||
    checkpoint.schemaVersion !== 3 ||
    !checkpoint.control ||
    checkpoint.run.id !== manifest.runId ||
    checkpoint.control.traceId !== manifest.traceId ||
    checkpoint.run.loomName !== manifest.loom.name ||
    checkpoint.loomIdentity !== manifest.loom.identityAtCapture ||
    !isDeepStrictEqual(checkpoint.control.boundary, manifest.boundary)
  )
    throw new Error("Mirror checkpoint identity or format is inconsistent.");
  const boundary = manifest.boundary;
  const phases = {
    loom_start: ["stage_pending"],
    stage_before_init: ["stage_pending"],
    stage_start: ["step_ready"],
    step_before: ["step_ready"],
    step_after: ["step_result"],
    stage_end: ["stage_pending", "terminal"],
    loom_end: ["terminal"],
  };
  if (
    !phases[boundary.kind].includes(checkpoint.phase) ||
    boundary.stageVisitId !== checkpoint.control.stageVisitId ||
    boundary.stepVisitId !== checkpoint.control.stepVisitId ||
    !["running", "paused", "completed", "failed"].includes(
      checkpoint.run.status,
    ) ||
    (manifest.restorable &&
      (!["stage_pending", "step_ready", "step_result"].includes(
        checkpoint.phase,
      ) ||
        !["running", "paused"].includes(checkpoint.run.status)))
  )
    throw new Error(
      "Mirror boundary, phase, visits or recoverability are inconsistent.",
    );
  if (
    ["loom_start", "stage_before_init"].includes(boundary.kind) &&
    checkpoint.stage
  )
    throw new Error(
      "Initialization boundary cannot carry an initialized Stage State.",
    );
  if (
    ["stage_start", "step_before", "step_after", "stage_end"].includes(
      boundary.kind,
    )
  ) {
    if (
      !checkpoint.stage ||
      checkpoint.stage.exists === undefined ||
      checkpoint.stage.stageName !== boundary.stageName ||
      checkpoint.stage.stageVisitId !== boundary.stageVisitId ||
      checkpoint.stage.role !==
        (boundary.kind === "stage_end" ? "exited" : "current")
    )
      throw new Error(
        "Mirror Stage State binding is inconsistent with its boundary.",
      );
  }
  if (
    boundary.kind === "step_after" &&
    (!checkpoint.result || !checkpoint.validatedRoute)
  )
    throw new Error(
      "step_after requires the validated unapplied result and route.",
    );
  if (
    ["stage_start", "step_before", "step_after", "stage_before_init"].includes(
      boundary.kind,
    ) &&
    checkpoint.run.cursor.stageName !== boundary.stageName
  )
    throw new Error("Mirror boundary does not match its execution cursor.");
  if (
    ["step_before", "step_after"].includes(boundary.kind) &&
    checkpoint.run.cursor.stepName !== boundary.stepName
  )
    throw new Error("Mirror Step does not match its execution cursor.");
  const snapshot = storageSnapshotSchema.parse(raw["storage.json"]);
  if (snapshot.backend !== manifest.storageBackend)
    throw new Error("Mirror Storage backend is inconsistent.");
  const files = filesSchema.parse(raw["files.json"]);
  validateFilePaths(files);
  await verifyFiles(join(directory, "files"), files);
  if (
    manifest.capture.files !== files.entries.length ||
    manifest.capture.bytes !==
      files.entries.reduce(
        (total, item) => total + (item.type === "file" ? item.size : 0),
        0,
      )
  )
    throw new Error("Mirror file counts are inconsistent.");
  return {
    directory,
    manifest,
    checkpoint,
    storage: snapshot,
    files,
    raw: raw as Record<(typeof names)[number], unknown>,
  };
}
async function directories(project: string): Promise<string[]> {
  const root = mirrorRoot(project);
  const found: string[] = [];
  if (!(await exists(root))) return found;
  await safePath(project, ".intloom/mirrors/runs");
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (
        entry.name.startsWith(".tmp-") ||
        entry.name === "files" ||
        entry.name === "images"
      )
        continue;
      if (entry.isSymbolicLink())
        throw new Error(
          `Symbolic link in mirror history: ${join(directory, entry.name)}`,
        );
      if (entry.isDirectory())
        await visit(
          await safePath(
            root,
            relative(root, join(directory, entry.name)).split(sep).join("/"),
          ),
        );
      else if (entry.name === "mirror.json") found.push(directory);
    }
  }
  await visit(root);
  return found;
}
export async function listMirrors(project: string): Promise<unknown[]> {
  return Promise.all(
    (await directories(project))
      .sort()
      .map(async (path) =>
        JSON.parse((await readBytes(path, "mirror.json")).toString("utf8")),
      ),
  );
}
export async function findMirror(
  project: string,
  mirrorId: string,
): Promise<string> {
  const matches: string[] = [];
  for (const directory of await directories(project))
    if (
      JSON.parse((await readBytes(directory, "mirror.json")).toString("utf8"))
        .mirrorId === mirrorId
    )
      matches.push(directory);
  if (matches.length !== 1)
    throw new Error(
      `Expected one mirror ${mirrorId}; found ${matches.length}.`,
    );
  return matches[0] as string;
}
function changes(
  before: unknown,
  after: unknown,
  path = "$",
  result: string[] = [],
): string[] {
  if (isDeepStrictEqual(before, after)) return result;
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const left = before as Record<string, unknown>,
      right = after as Record<string, unknown>;
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)]))
      changes(left[key], right[key], `${path}.${key}`, result);
  } else result.push(path);
  return result;
}
function idDiff(
  before: readonly Record<string, unknown>[],
  after: readonly Record<string, unknown>[],
  key: string,
) {
  const left = new Map(before.map((item) => [String(item[key]), item]));
  const right = new Map(after.map((item) => [String(item[key]), item]));
  return {
    added: [...right.keys()].filter((id) => !left.has(id)),
    deleted: [...left.keys()].filter((id) => !right.has(id)),
    modified: [...right.keys()].filter(
      (id) => left.has(id) && !isDeepStrictEqual(left.get(id), right.get(id)),
    ),
  };
}
async function diffSummary(
  project: string,
  directory: string,
  raw: Record<string, unknown>,
) {
  const current = raw["mirror.json"] as MirrorManifest;
  const candidates: { directory: string; manifest: MirrorManifest }[] = [];
  for (const path of await directories(project)) {
    if (path === directory) continue;
    const parsed = manifestSchema.safeParse(
      JSON.parse((await readBytes(path, "mirror.json")).toString("utf8")),
    );
    if (
      parsed.success &&
      parsed.data.traceId === current.traceId &&
      parsed.data.capturedAt < current.capturedAt
    )
      candidates.push({ directory: path, manifest: parsed.data });
  }
  const previous = candidates.sort((a, b) =>
    b.manifest.capturedAt.localeCompare(a.manifest.capturedAt),
  )[0];
  if (!previous) return null;
  const prior = await readMirrorDirectory(previous.directory),
    next = await readMirrorDirectory(directory);
  return {
    previousMirrorId: previous.manifest.mirrorId,
    files: idDiff(prior.files.entries, next.files.entries, "path"),
    stateFields: changes(prior.checkpoint.stage, next.checkpoint.stage),
    artifacts: idDiff(prior.storage.artifacts, next.storage.artifacts, "id"),
    records: idDiff(prior.storage.records, next.storage.records, "id"),
    validatedRoute: next.checkpoint.validatedRoute ?? null,
  };
}
/** Offline inspection keeps unknown fields and does not load the Loom. */
export async function inspectMirror(project: string, mirrorId: string) {
  const directory = await findMirror(project, mirrorId);
  const raw = Object.fromEntries(
    await Promise.all(
      names.map(
        async (name) =>
          [
            name,
            JSON.parse((await readBytes(directory, name)).toString("utf8")),
          ] as const,
      ),
    ),
  );
  let integrity: { valid: boolean; cause?: string } = { valid: true };
  try {
    await readMirrorDirectory(directory);
  } catch (cause) {
    integrity = {
      valid: false,
      cause: cause instanceof Error ? cause.message : String(cause),
    };
  }
  return {
    directory,
    integrity,
    ...(raw as Record<(typeof names)[number], unknown>),
    diffSummary: integrity.valid
      ? await diffSummary(project, directory, raw).catch(() => null)
      : null,
    limitations: [
      "Only the declared local file scope and formal Storage are restored.",
      "External services and effects are not copied or reversed.",
      "Current target Loom and configuration are required for execution.",
    ],
  };
}
export async function exportMirrors(
  project: string,
  traceId: string,
  target: string,
) {
  const parent = await realpath(dirname(resolve(target)));
  target = join(parent, basename(target));
  project = await realpath(project);
  if (inside(project, target) || inside(target, project))
    throw new Error(
      "Export destination must be independent of source project.",
    );
  if (await exists(target))
    throw new Error(`Export destination already exists: ${target}`);
  const matching: string[] = [];
  for (const directory of await directories(project))
    if (
      JSON.parse((await readBytes(directory, "mirror.json")).toString("utf8"))
        .traceId === traceId
    )
      matching.push(directory);
  if (!matching.length) throw new Error(`Mirror trace not found: ${traceId}`);
  await mkdir(dirname(target), { recursive: true });
  const temporary = await mkdtemp(join(dirname(target), ".mirror-export-"));
  try {
    for (const directory of matching) {
      const manifest = JSON.parse(
        (await readBytes(directory, "mirror.json")).toString("utf8"),
      );
      const destination = await safePath(temporary, manifest.mirrorId);
      await mkdir(destination, { mode: 0o700 });
      // Format-independent raw copy; unsupported formats remain offline data only.
      async function copyTree(source: string, prefix: string): Promise<void> {
        for (const item of await readdir(source, { withFileTypes: true })) {
          const path = `${prefix}${item.name}`;
          if (item.isDirectory()) {
            await mkdir(await safePath(destination, path), { mode: 0o700 });
            await copyTree(join(source, item.name), `${path}/`);
          } else if (item.isFile())
            await writeBytes(
              destination,
              path,
              await readBytes(directory, path),
              ((await lstat(join(directory, path))).mode & 0o111) !== 0,
            );
          else throw new Error(`Unsafe export entry: ${path}`);
        }
      }
      await copyTree(directory, "");
    }
    if (await exists(target))
      throw new Error("Export destination changed during copy.");
    await rename(temporary, target);
    return { targetProject: target, traceId, mirrors: matching.length };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
export function validateScope(
  manifest: MirrorManifest,
  scope: MirrorScope,
): void {
  if (!manifest.restorable || manifest.boundary.kind === "loom_end")
    throw new Error(
      manifest.reason ?? "Mirror is not a resumable safe boundary.",
    );
  if (scope === "step" && manifest.boundary.kind !== "step_before")
    throw new Error(
      "Step scope requires step_before; step_after already completed the call. Choose an actual next step_before image.",
    );
  if (scope === "stage" && manifest.boundary.kind === "stage_end")
    throw new Error(
      "stage_end cannot restore stage scope: that visit has ended.",
    );
}
export function restoreFailure(cause: unknown): LoomError<string> {
  return new LoomError(
    "MIRROR_RESTORE_FAILED",
    `${cause instanceof Error ? cause.message : String(cause)} Please manually execute the Loom from the beginning to generate new mirrors.`,
    { retryable: false, cause },
  );
}
/** Caller holds the project service lock; only this attempt's paths are removed on failure. */
export async function commitRestore(
  target: string,
  source: Awaited<ReturnType<typeof readMirrorDirectory>>,
  checkpoint: CheckpointSnapshot,
  protectedPaths: string[],
  options: {
    dryRun?: boolean;
    failAt?: "import" | "files" | "checkpoint";
  } = {},
) {
  validateFilePaths(source.files, { protectedPaths });
  const runtime = await safePath(target, ".intloom/runtime");
  const storageTarget = await safePath(target, "intloom");
  async function checkEmpty(): Promise<void> {
    for (const directory of [runtime, storageTarget])
      if (await exists(directory)) {
        if ((await readdir(directory)).length)
          throw new Error(
            `Restore target contains existing business Storage or checkpoints: ${directory}`,
          );
      }
    for (const entry of source.files.entries) {
      const path = await safePath(target, entry.path);
      if (await exists(path)) {
        if (entry.type === "directory" && (await lstat(path)).isDirectory())
          continue;
        throw new Error(`Restore file target already exists: ${entry.path}`);
      }
    }
    const business = await scanFiles(target, { protectedPaths });
    if (business.entries.some((entry) => entry.type === "file"))
      throw new Error(
        `Restore target contains business files: ${business.entries.find((entry) => entry.type === "file")?.path}`,
      );
  }
  await checkEmpty();
  const plan = {
    files: source.files.entries.map((entry) => join(target, entry.path)),
    storage: storageTarget,
    checkpoint: runtime,
  };
  if (options.dryRun) return { dryRun: true, plan };
  const temp = await mkdtemp(join(dirname(target), ".intloom-restore-"));
  const created: string[] = [];
  const originalStorage = await exists(storageTarget);
  const originalRuntime = await exists(runtime);
  const lock = ".intloom/restore.lock";
  const commitId = checkpoint.control?.restoreCommitId;
  if (!commitId)
    throw new Error("Restore checkpoint is missing its commit identity.");
  const marker = `.intloom/restores/${commitId}.json`;
  let imported: StorageHandle | undefined;
  let publishedStorage = false;
  let locked = false;
  try {
    await writeBytes(
      target,
      lock,
      Buffer.from(
        JSON.stringify({
          commitId,
          temporary: temp,
          plan,
          originalStorage,
          originalRuntime,
          createdPaths: created,
        }),
      ),
    );
    locked = true;
    async function updateLock(): Promise<void> {
      const temporaryLock = `.intloom/.restore-${randomUUID()}.tmp`;
      try {
        await writeJson(target, temporaryLock, {
          commitId,
          temporary: temp,
          plan,
          originalStorage,
          originalRuntime,
          createdPaths: [...created],
        });
        await safePath(target, lock);
        await rename(join(target, temporaryLock), join(target, lock));
      } finally {
        await rm(join(target, temporaryLock), { force: true });
      }
    }
    async function track(path: string): Promise<void> {
      created.push(path);
      await updateLock();
    }
    imported =
      source.storage.backend === "file"
        ? await openFileStorage({
            directory: join(temp, "intloom"),
            layout: "directories",
          })
        : await openSqliteStorage({
            filename: join(temp, "intloom/storage.sqlite"),
            projectId: "project",
          });
    if (!imported.importSnapshot || !imported.exportSnapshot)
      throw new Error("Target Storage cannot import mirrors.");
    await imported.importSnapshot(source.storage);
    const roundtrip = await imported.exportSnapshot();
    if (
      !isDeepStrictEqual(roundtrip.artifacts, source.storage.artifacts) ||
      !isDeepStrictEqual(roundtrip.records, source.storage.records) ||
      roundtrip.metadata.revision !== source.storage.metadata.revision
    )
      throw new Error("Imported Storage did not preserve formal data.");
    await imported.dispose();
    imported = undefined;
    if (options.failAt === "import")
      throw new Error("Injected restore import failure.");
    await mkdir(join(temp, "files"), { mode: 0o700 });
    await copyFiles(
      join(source.directory, "files"),
      join(temp, "files"),
      source.files,
    );
    await verifyFiles(join(temp, "files"), source.files);
    await checkEmpty();
    // Track newly created parents individually; never recursively remove existing target folders.
    async function parents(path: string): Promise<void> {
      const list: string[] = [];
      for (
        let directory = dirname(path);
        directory !== target && inside(target, directory);
        directory = dirname(directory)
      )
        if (!(await exists(directory))) list.push(directory);
      for (const directory of list.reverse()) {
        await mkdir(directory, { mode: 0o700 });
        await track(directory);
      }
    }
    for (const entry of source.files.entries) {
      const path = await safePath(target, entry.path);
      await parents(path);
      if (entry.type === "directory") {
        if (await exists(path)) continue;
        await mkdir(path, { mode: 0o700 });
        await track(path);
      } else
        await writeBytes(
          target,
          entry.path,
          await readBytes(join(temp, "files"), entry.path),
          entry.executable,
          track,
        );
    }
    if (options.failAt === "files")
      throw new Error("Injected restore files publication failure.");
    await rename(join(temp, "intloom"), storageTarget);
    publishedStorage = true;
    await parents(join(target, marker));
    await writeJson(
      target,
      marker,
      {
        schemaVersion: 1,
        complete: true,
        commitId,
        traceId: checkpoint.control?.traceId,
        runId: checkpoint.run.id,
        sourceMirrorId: source.manifest.mirrorId,
      },
      track,
    );
    if (options.failAt === "checkpoint")
      throw new Error("Injected restore checkpoint publication failure.");
    const store = openRunCheckpointStore(runtime);
    created.push(
      join(
        runtime,
        `${(await import("node:crypto")).createHash("sha256").update(checkpoint.run.id).digest("hex")}.json`,
      ),
    );
    await updateLock();
    store.write(checkpoint);
    // No operation that can invalidate commit is done between checkpoint publication and lock removal.
    await rm(join(target, lock));
    locked = false;
    return { dryRun: false, plan };
  } catch (cause) {
    const cleanup: unknown[] = [];
    await imported?.dispose().catch((error) => cleanup.push(error));
    if (publishedStorage) {
      await rm(storageTarget, { recursive: true, force: true }).catch((error) =>
        cleanup.push(error),
      );
      if (originalStorage)
        await mkdir(storageTarget).catch((error) => cleanup.push(error));
    }
    for (const path of created.reverse()) {
      try {
        if ((await lstat(path)).isDirectory()) await rmdir(path);
        else await rm(path);
      } catch (error) {
        if (!isMissing(error)) cleanup.push(error);
      }
    }
    if (!originalRuntime)
      await rm(runtime, { recursive: true, force: true }).catch((error) =>
        cleanup.push(error),
      );
    if (!cleanup.length && locked) {
      await rm(join(target, lock)).catch((error) => cleanup.push(error));
      if (!cleanup.length) locked = false;
    }
    if (cleanup.length)
      throw new AggregateError(
        [cause, ...cleanup],
        `Restore cleanup failed. Keep host stopped; inspect ${join(target, lock)} and ${temp}.`,
      );
    throw cause;
  } finally {
    if (!locked) await rm(temp, { recursive: true, force: true });
  }
}
