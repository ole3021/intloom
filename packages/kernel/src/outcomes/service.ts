import { createHash } from "node:crypto";
import { canonicalize } from "json-canonicalize";
import {
  IntloomError,
  type ArtifactRef,
  type ArtifactRecord,
  type AcceptanceRecord,
  type AcceptanceResult,
  type JsonValue,
  type ArtifactRead,
} from "@intloom/loom-sdk";
import { copyJson, stableJson } from "@intloom/loom-sdk/json";
import type {
  OutcomeServices,
  OutcomeRepository,
  OutcomeProjection,
} from "./contracts.ts";
import type { Kernel } from "../api-contracts.ts";
import { createArtifactStorage } from "../persistence/artifacts.ts";

const digest = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
const unsatisfied = (message: string) =>
  new IntloomError("OUTCOME_CONTRACT_UNSATISFIED", message);
function subjectDigest(value: JsonValue): string {
  const unicode = (value: JsonValue): void => {
    if (typeof value === "string" && /[\uD800-\uDFFF]/u.test(value))
      throw unsatisfied("Acceptance subjects require valid Unicode.");
    if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (/[\uD800-\uDFFF]/u.test(key))
          throw unsatisfied("Acceptance subjects require valid Unicode keys.");
        unicode(item);
      }
    }
  };
  unicode(value);
  return digest(canonicalize(value));
}
function pointer(value: JsonValue, path: string): JsonValue | undefined {
  if (!path) return value;
  let current: JsonValue | undefined = value;
  for (const token of path.slice(1).split("/")) {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, key) ||
      (Array.isArray(current) && !/^(0|[1-9][0-9]*)$/.test(key))
    )
      return undefined;
    current = (current as Record<string, JsonValue>)[key];
  }
  return current;
}
export function createOutcomeServices(options: {
  repository: OutcomeRepository;
  directory(runId: string): string;
  id(): string;
  now(): string;
}): OutcomeServices & {
  exportArtifact: Kernel["exportArtifact"];
  getArtifact(id: string): Promise<ArtifactRecord>;
  getAcceptance(id: string): Promise<AcceptanceRecord>;
  readArtifact(options: {
    artifactId: string;
    offset?: number;
    length?: number;
  }): Promise<ArtifactRead>;
} {
  const { repository, id, now } = options;
  const files = createArtifactStorage(options.directory);
  const getArtifact = async (id: string) => {
    const record = await repository.getArtifact(id);
    if (!record)
      throw new IntloomError("ARTIFACT_NOT_FOUND", "Artifact was not found.", {
        artifactId: id,
      });
    return record;
  };
  const getAcceptance = async (id: string) => {
    const record = await repository.getAcceptance(id);
    if (!record)
      throw new IntloomError(
        "ACCEPTANCE_NOT_FOUND",
        "Acceptance was not found.",
        { acceptanceId: id },
      );
    return record;
  };
  const artifact = async (value: unknown): Promise<ArtifactRecord> => {
    const ref = value as ArtifactRef | null;
    if (
      ref?.kind !== "artifact" ||
      typeof ref.id !== "string" ||
      typeof ref.runId !== "string"
    )
      throw unsatisfied("Expected a persistent Artifact reference.");
    const record = await getArtifact(ref.id).catch((error: unknown) => {
      if (error instanceof IntloomError && error.code === "STORAGE_UNAVAILABLE")
        throw new IntloomError(error.code, error.message, {
          ...(error.details as { directory: string }),
          artifactId: ref.id,
        });
      throw error;
    });
    if (record.runId !== ref.runId)
      throw unsatisfied("Artifact owner does not match its record.");
    return record;
  };
  const references = async (
    value: JsonValue,
    found: Map<string, ArtifactRecord>,
  ): Promise<void> => {
    if (!value || typeof value !== "object") return;
    if (!Array.isArray(value) && value.kind === "artifact") {
      const record = await artifact(value);
      if (!found.has(record.id)) {
        await files.read(record, 0, 0);
        found.set(record.id, record);
      }
    } else
      for (const item of Object.values(value)) await references(item, found);
  };
  return {
    getArtifact,
    getAcceptance,
    async exportArtifact({ artifactId, path, overwrite }) {
      return files.export(await getArtifact(artifactId), path, overwrite);
    },
    async readArtifact({ artifactId, offset = 0, length = 1024 * 1024 }) {
      const record = await getArtifact(artifactId);
      if (offset > record.size)
        throw new IntloomError(
          "INVALID_ARGUMENT",
          "Offset exceeds Artifact size.",
        );
      const data = await files.read(record, offset, length);
      return {
        data,
        offset,
        length: data.byteLength,
        totalSize: record.size,
        eof: offset + data.byteLength === record.size,
      };
    },
    context(run, scope) {
      return {
        artifacts: {
          async write({ name, mediaType, data }) {
            if (
              typeof name !== "string" ||
              !name ||
              typeof mediaType !== "string" ||
              !mediaType ||
              (typeof data !== "string" && !(data instanceof Uint8Array))
            )
              throw new IntloomError(
                "INVALID_ARGUMENT",
                "Artifact requires a name, mediaType and string or bytes.",
              );
            const value =
              typeof data === "string"
                ? new TextEncoder().encode(data)
                : new Uint8Array(data);
            const record: ArtifactRecord = {
              id: id(),
              runId: run.view.id,
              name,
              mediaType,
              size: value.byteLength,
              digest: digest(value),
              createdAt: now(),
              ...structuredClone(scope),
            };
            await files.write(record, value);
            await repository.saveArtifact(record);
            return { kind: "artifact", id: record.id, runId: record.runId };
          },
          async readBytes(ref) {
            return files.read(await artifact(ref));
          },
          async readText(ref) {
            const record = await artifact(ref);
            if (
              !/^(text\/|application\/(?:json|xml|[^;]+\+(?:json|xml))(?:;|$)|image\/svg\+xml(?:;|$))/i.test(
                record.mediaType,
              )
            )
              throw new IntloomError(
                "ARTIFACT_NOT_TEXT",
                "Artifact media type is not text.",
              );
            const value = await files.read(record);
            try {
              return new TextDecoder("utf-8", { fatal: true }).decode(value);
            } catch {
              throw new IntloomError(
                "ARTIFACT_NOT_TEXT",
                "Artifact is not valid UTF-8 text.",
              );
            }
          },
        },
        acceptance: {
          async record(value) {
            const contract = run.binding.outcome?.acceptance;
            if (!contract)
              throw unsatisfied(
                "This Loom did not declare Acceptance criteria.",
              );
            let subject: JsonValue, result: AcceptanceResult;
            try {
              subject = copyJson(value.subject, "acceptance.subject");
              result = copyJson(
                value.result,
                "acceptance.result",
              ) as AcceptanceResult;
            } catch {
              throw unsatisfied(
                "Acceptance subject and result must be finite JSON data.",
              );
            }
            const found = new Map<string, ArtifactRecord>();
            await references(subject, found);
            const hash = subjectDigest(subject);
            let status: AcceptanceRecord["status"];
            if (result.error) status = "error";
            else {
              const ids = new Set(
                result.checks.map((check) => check.criterionId),
              );
              if (
                ids.size !== result.checks.length ||
                ids.size !== contract.criteria.length ||
                contract.criteria.some((criterion) => !ids.has(criterion.id))
              )
                throw unsatisfied(
                  "Acceptance checks must cover each declared criterion exactly once.",
                );
              for (const check of result.checks)
                for (const ref of check.evidence ?? [])
                  await references(ref, found);
              status = result.checks.some(
                (check) => check.status === "rejected",
              )
                ? "rejected"
                : "passed";
            }
            const record: AcceptanceRecord = {
              id: id(),
              runId: run.view.id,
              ...structuredClone(scope),
              createdAt: now(),
              subject,
              subjectDigest: hash,
              criteria: contract.criteria,
              result,
              status,
            };
            await repository.saveAcceptance(record);
            return { kind: "acceptance", id: record.id, runId: record.runId };
          },
        },
      };
    },
    async complete(run, output) {
      const contract = run.binding.outcome;
      try {
        const deliveries: Record<string, readonly ArtifactRef[]> = {};
        const found = new Map<string, ArtifactRecord>();
        await references(output, found);
        if (!contract) return { quality: "not_requested" };
        for (const [slot, spec] of Object.entries(contract.artifacts ?? {})) {
          const selected = pointer(output, spec.at);
          if (selected === undefined && spec.required === false) continue;
          if (
            selected === undefined ||
            (spec.multiple && !Array.isArray(selected))
          )
            throw unsatisfied(
              `Artifact slot ${slot} is missing or has the wrong cardinality.`,
            );
          const refs = spec.multiple ? (selected as JsonValue[]) : [selected];
          if (spec.required !== false && !refs.length)
            throw unsatisfied(`Artifact slot ${slot} is empty.`);
          for (const ref of refs) {
            const record = await artifact(ref);
            if (spec.mediaTypes && !spec.mediaTypes.includes(record.mediaType))
              throw unsatisfied(
                `Artifact slot ${slot} has an unsupported media type.`,
              );
            await references(ref, found);
          }
          Object.defineProperty(deliveries, slot, {
            value: refs,
            enumerable: true,
          });
        }
        const projection: OutcomeProjection = {
          quality: "not_requested",
          outcome: { ...contract, deliveries },
        };
        if (!contract.acceptance) return projection;
        const selected = pointer(output, contract.acceptance.at);
        if (
          !selected ||
          typeof selected !== "object" ||
          Array.isArray(selected) ||
          selected.kind !== "acceptance" ||
          typeof selected.id !== "string" ||
          selected.runId !== run.view.id
        )
          throw unsatisfied("The final Acceptance must belong to this Run.");
        const report = await getAcceptance(selected.id);
        const subject = pointer(output, contract.acceptance.subjectAt);
        if (
          report.runId !== run.view.id ||
          subject === undefined ||
          report.subjectDigest !== subjectDigest(subject) ||
          stableJson(report.criteria) !==
            stableJson(contract.acceptance.criteria)
        )
          throw unsatisfied(
            "The final Acceptance does not describe this candidate and criteria.",
          );
        await references(subject, found);
        for (const check of report.result.checks ?? [])
          for (const ref of check.evidence ?? []) await references(ref, found);
        if (report.status === "error")
          throw new IntloomError(
            "ACCEPTANCE_EXECUTION_FAILED",
            "The final Acceptance records a technical error.",
            { acceptanceId: report.id },
          );
        return {
          ...projection,
          quality: report.status,
          acceptance: {
            kind: "acceptance",
            id: report.id,
            runId: report.runId,
            status: report.status,
            subjectDigest: report.subjectDigest,
          },
        };
      } catch (error) {
        if (
          error instanceof IntloomError &&
          error.code === "STORAGE_UNAVAILABLE" &&
          (error.details as { directory: string }).directory !==
            run.binding.location.dataDir
        ) {
          throw new IntloomError(
            "OUTCOME_CONTRACT_UNSATISFIED",
            "The referenced outcome storage is unavailable.",
            error.details,
          );
        }
        if (
          error instanceof IntloomError &&
          [
            "ARTIFACT_NOT_FOUND",
            "ARTIFACT_UNAVAILABLE",
            "ACCEPTANCE_NOT_FOUND",
          ].includes(error.code)
        )
          throw unsatisfied(
            "A selected Artifact or Acceptance is unavailable.",
          );
        throw error;
      }
    },
  };
}
