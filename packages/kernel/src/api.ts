import { resolve } from "node:path";
import { IntloomError } from "@intloom/loom-sdk";
import { PackageError } from "@intloom/loom-sdk/package-format";
import { z } from "zod";
import type { Kernel, ServeOptions } from "./api-contracts.ts";
import type { createKernel } from "./lifecycle/coordinator.ts";
import type { createLoomCatalog } from "./packages/catalog.ts";
import type { PackageStore } from "./packages/store.ts";
import type { openStorage } from "./persistence/storage.ts";
import type { createOutcomeServices } from "./outcomes/service.ts";
import { bindingsSchema } from "./execution/bindings.ts";
import { pageAfter, pageResult } from "./query.ts";
import { projectRunActivity } from "./query/activity.ts";
import { createEventQuery } from "./query/events.ts";

const id = z.string().min(1);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const identity = z.strictObject({ id, version: id });
const ref = identity.extend({ artifactDigest: digest });
const selector = z.union([
  ref,
  identity.partial({ version: true }).extend({ command: id.optional() }),
  z.strictObject({ artifactDigest: digest }),
]);
const pagination = {
  cursor: id.optional(),
  limit: z.number().int().min(1).max(100).optional(),
};
function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new IntloomError(
      "INVALID_ARGUMENT",
      "Operation arguments are invalid.",
      {
        paths: parsed.error.issues.map((issue) =>
          issue.path.map(String).join("."),
        ),
      },
    );
  return parsed.data;
}

export function validateServeOptions(options: ServeOptions) {
  parse(
    z.strictObject({
      dataDir: id,
      recoverUpgrade: z.boolean().optional(),
      onRunEvents: z
        .custom<NonNullable<ServeOptions["onRunEvents"]>>(
          (value) => typeof value === "function",
        )
        .optional(),
      projectDir: id.optional(),
      bindings: bindingsSchema
        .pick({ tools: true, resolveCredential: true })
        .optional(),
    }),
    options,
  );
}

export function createKernelApi(dependencies: {
  kernel: Awaited<ReturnType<typeof createKernel>>;
  repository: Awaited<ReturnType<typeof openStorage>>;
  packages: PackageStore;
  outcomes: ReturnType<typeof createOutcomeServices>;
  catalog: ReturnType<typeof createLoomCatalog>;
  projectDir: string | undefined;
  available(): void;
  isClosing(): boolean;
  close(cancelRuns: boolean): Promise<void>;
  observationClosed: AbortSignal;
}): Kernel {
  const {
    kernel,
    repository,
    packages,
    outcomes,
    catalog,
    projectDir,
    available,
    isClosing,
    close,
    observationClosed,
  } = dependencies;
  const events = createEventQuery(
    repository,
    kernel.listRunEvents,
    observationClosed,
  );
  return {
    async installLoom(options) {
      available();
      if (isClosing())
        throw new IntloomError(
          "SERVICE_BUSY",
          "The Intloom service is closing.",
        );
      parse(
        z.strictObject({
          source: id,
          dependencySources: z.array(id).optional(),
          snapshotOnly: z.boolean().optional(),
          installedDirectory: z.boolean().optional(),
          expected: z.strictObject({ id, version: id.optional() }).optional(),
        }),
        options,
      );
      return packages.installLoom(options).catch((error: unknown) => {
        throw new IntloomError(
          error instanceof PackageError ? error.code : "STORAGE_FAILED",
          "The Loom package could not be installed.",
        );
      });
    },
    async removeLoom(name) {
      available();
      parse(id, name);
      return packages.removeDirect(name);
    },
    async listLooms(options = {}) {
      available();
      parse(z.strictObject({ ...pagination, id: id.optional() }), options);
      return catalog.listLooms(options);
    },
    async getLoom(value) {
      available();
      parse(selector, value);
      return catalog.getLoom(value);
    },
    async getLoomCatalog(locked) {
      available();
      parse(z.array(ref).optional(), locked);
      return catalog.getLoomCatalog(locked);
    },
    async createRun(options, project) {
      available();
      parse(
        z.strictObject({
          loom: ref,
          input: z.unknown().optional(),
          inputFiles: z.array(id).optional(),
          confirmDelivery: z.boolean().optional(),
        }),
        options,
      );
      const directory = project ?? projectDir;
      return kernel.createRun({
        ...options,
        ...(directory ? { projectDir: resolve(directory) } : {}),
      });
    },
    async startRun(runId) {
      available();
      parse(id, runId);
      return kernel.startRun(runId);
    },
    async resumeRun(options) {
      available();
      parse(
        z.union([
          z.strictObject({ runId: id, requestId: id }),
          z.strictObject({
            runId: id,
            waitId: id,
            resumeData: z.json().optional(),
          }),
        ]),
        options,
      );
      return kernel.resumeRun(options);
    },
    async listInteractions(options) {
      available();
      parse(
        z.strictObject({
          runId: id,
          status: z.enum(["pending", "answered", "closed"]).optional(),
        }),
        options,
      );
      return kernel.listInteractions(options);
    },
    async getInteraction(requestId) {
      available();
      parse(id, requestId);
      return kernel.getInteraction(requestId);
    },
    async respondInteraction(requestId, response, callerContext) {
      available();
      parse(id, requestId);
      parse(
        z.union([
          z.strictObject({ action: z.literal("submit"), value: z.json() }),
          z.strictObject({ action: z.enum(["decline", "dismiss"]) }),
        ]),
        response,
      );
      parse(
        z.strictObject({
          source: z.strictObject({
            kind: z.enum(["human", "agent", "program", "test", "unknown"]),
            via: z.enum(["cli", "mcp", "api"]),
            actorId: id.optional(),
          }),
        }),
        callerContext,
      );
      return kernel.respondInteraction(requestId, response, callerContext);
    },
    async cancelRun(runId, reason) {
      available();
      parse(id, runId);
      parse(id.optional(), reason);
      return kernel.cancelRun(runId, reason);
    },
    async getRun(runId) {
      available();
      parse(id, runId);
      return kernel.getRun(runId);
    },
    async getRunResult(runId) {
      available();
      parse(id, runId);
      return kernel.getRunResult(runId);
    },
    async getArtifactCatalog(options = {}) {
      available();
      parse(z.strictObject(pagination), options);
      const filter = { kind: "artifact_catalog" };
      const records = await repository.listArtifacts({
        after: pageAfter(options.cursor, filter),
        limit: (options.limit ?? 20) + 1,
      });
      return pageResult(
        records,
        (value) => `${value.createdAt}/${value.id}`,
        filter,
        options,
      );
    },
    async listArtifacts(options) {
      available();
      parse(z.strictObject({ runId: id, ...pagination }), options);
      await kernel.getRun(options.runId);
      const filter = { kind: "artifacts", runId: options.runId };
      const records = await repository.listArtifacts({
        runId: options.runId,
        after: pageAfter(options.cursor, filter),
        limit: (options.limit ?? 20) + 1,
      });
      return pageResult(
        records,
        (value) => `${value.createdAt}/${value.id}`,
        filter,
        options,
      );
    },
    async getArtifact(artifactId) {
      available();
      parse(id, artifactId);
      return outcomes.getArtifact(artifactId);
    },
    async exportArtifact(options) {
      available();
      parse(
        z.strictObject({
          artifactId: id,
          path: id,
          overwrite: z.boolean().optional(),
        }),
        options,
      );
      return outcomes.exportArtifact(options);
    },
    async readArtifact(options) {
      available();
      parse(
        z.strictObject({
          artifactId: id,
          offset: z.number().int().nonnegative().optional(),
          length: z
            .number()
            .int()
            .min(1)
            .max(1024 * 1024)
            .optional(),
        }),
        options,
      );
      return outcomes.readArtifact(options);
    },
    async listAcceptances(options) {
      available();
      parse(z.strictObject({ runId: id, ...pagination }), options);
      await kernel.getRun(options.runId);
      const filter = { kind: "acceptances", runId: options.runId };
      const records = await repository.listAcceptances({
        runId: options.runId,
        after: pageAfter(options.cursor, filter),
        limit: (options.limit ?? 20) + 1,
      });
      return pageResult(
        records,
        (value) => `${value.createdAt}/${value.id}`,
        filter,
        options,
      );
    },
    async getAcceptance(acceptanceId) {
      available();
      parse(id, acceptanceId);
      return outcomes.getAcceptance(acceptanceId);
    },
    async getRunOverview() {
      available();
      return repository.overview();
    },
    async listUnfinishedRuns(options = {}) {
      available();
      parse(z.strictObject(pagination), options);
      const filter = { unfinished: true };
      const views = await kernel.listRuns({
        unfinished: true,
        after: pageAfter(options.cursor, filter),
        limit: (options.limit ?? 20) + 1,
      });
      return pageResult(
        views,
        (view) => `${view.createdAt}/${view.id}`,
        filter,
        options,
      );
    },
    async listRuns(options = {}) {
      available();
      parse(
        z.strictObject({
          ...pagination,
          status: z
            .enum([
              "created",
              "running",
              "waiting",
              "stopping",
              "succeeded",
              "failed",
              "cancelled",
              "interrupted",
            ])
            .optional(),
          loom: selector.optional(),
          parentRunId: id.optional(),
        }),
        options,
      );
      const filter = {
        status: options.status,
        loom: options.loom,
        parentRunId: options.parentRunId,
      };
      const views = await kernel.listRuns({
        after: pageAfter(options.cursor, filter),
        limit: (options.limit ?? 20) + 1,
        status: options.status,
        loom: options.loom,
        parentRunId: options.parentRunId,
      });
      return pageResult(
        views,
        (view) => `${view.createdAt}/${view.id}`,
        filter,
        options,
      );
    },
    async getRunActivity(runId) {
      available();
      parse(id, runId);
      const snapshot = await kernel.getActivitySnapshot(runId);
      const { manifest } = await packages.getLoom(snapshot.record.view.loom);
      return projectRunActivity(snapshot, manifest);
    },
    async listRunEvents(options, signal) {
      available();
      parse(
        z.strictObject({
          runId: id,
          after: z.number().int().nonnegative().optional(),
          limit: pagination.limit,
          waitMs: z.number().int().min(0).max(10_000).optional(),
        }),
        options,
      );
      return events(options, signal);
    },
    async getStorageIssues() {
      return repository.issues();
    },
    close() {
      return close(false);
    },
    shutdown() {
      return close(true);
    },
    get activeRunCount() {
      return kernel.activeRunCount;
    },
  };
}
