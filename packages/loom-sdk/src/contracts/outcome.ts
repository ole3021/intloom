import type { ExecutionScope } from "./events.ts";
import { z } from "zod";
import type { JsonValue } from "./json.ts";
import { DefinitionError, checkId } from "../definitions/errors.ts";

export const ArtifactRefSchema = z.strictObject({
  kind: z.literal("artifact"),
  id: z.string().min(1),
  runId: z.string().min(1),
});
export const AcceptanceRefSchema = z.strictObject({
  kind: z.literal("acceptance"),
  id: z.string().min(1),
  runId: z.string().min(1),
});
export type ArtifactRef = z.output<typeof ArtifactRefSchema>;
export type AcceptanceRef = z.output<typeof AcceptanceRefSchema>;

export const AcceptanceReportSchema = z.strictObject({
  checks: z
    .array(
      z.strictObject({
        criterionId: z.string().min(1),
        status: z.enum(["passed", "rejected"]),
        message: z.string().optional(),
        evidence: z.array(ArtifactRefSchema).optional(),
      }),
    )
    .min(1),
});
export type AcceptanceReport = z.output<typeof AcceptanceReportSchema>;
export type QualityStatus = "passed" | "rejected" | "not_requested";
export type ExecutionOrigin = {
  readonly componentId: string;
  readonly workflowId?: string;
  readonly stepPath?: string[];
};
export type ExecutionError = {
  readonly origin?: ExecutionOrigin;
  readonly businessCode?: string;
  readonly code: string;
  readonly message: string;
  readonly details?: JsonValue;
};
export type AcceptanceResult =
  | {
      readonly checks: AcceptanceReport["checks"];
      readonly error?: never;
    }
  | { readonly error: ExecutionError; readonly checks?: never };

export interface ArtifactRecord extends ExecutionScope {
  readonly id: string;
  readonly runId: string;
  readonly name: string;
  readonly mediaType: string;
  readonly size: number;
  readonly digest: string;
  readonly createdAt: string;
}
export interface ArtifactRead {
  readonly data: Uint8Array;
  readonly offset: number;
  readonly length: number;
  readonly totalSize: number;
  readonly eof: boolean;
}
export interface AcceptanceRecord extends ExecutionScope {
  readonly id: string;
  readonly runId: string;
  readonly createdAt: string;
  readonly subject: JsonValue;
  readonly subjectDigest: string;
  readonly criteria: NonNullable<OutcomeContract["acceptance"]>["criteria"];
  readonly result: AcceptanceResult;
  readonly status: "passed" | "rejected" | "error";
}
export interface AcceptanceSummary extends AcceptanceRef {
  readonly status: AcceptanceRecord["status"];
  readonly subjectDigest: string;
}
export interface OutcomeView extends OutcomeContract {
  /** Present only after successful delivery; includes only output-selected versions. */
  readonly deliveries?: Readonly<Record<string, readonly ArtifactRef[]>>;
}

export interface OutcomeContract {
  readonly description?: string;
  readonly artifacts?: Readonly<
    Record<
      string,
      {
        readonly at: string;
        readonly description?: string;
        readonly mediaTypes?: readonly string[];
        readonly multiple?: boolean;
        readonly required?: boolean;
      }
    >
  >;
  readonly acceptance?: {
    readonly at: string;
    readonly subjectAt: string;
    readonly criteria: readonly {
      readonly id: string;
      readonly description: string;
    }[];
  };
}

export function checkOutcome(outcome: OutcomeContract): void {
  const pointer = (value: string, path: string) => {
    if (!/^(?:\/(?:[^~]|~[01])*)*$/.test(value))
      throw new DefinitionError(
        "DEFINITION_INVALID",
        path,
        "Expected an RFC 6901 JSON Pointer.",
      );
  };
  for (const [slot, artifact] of Object.entries(outcome.artifacts ?? {})) {
    checkId(slot, `outcome.artifacts.${slot}`);
    pointer(artifact.at, `outcome.artifacts.${slot}.at`);
  }
  if (outcome.acceptance) {
    const { at, subjectAt, criteria } = outcome.acceptance;
    pointer(at, "outcome.acceptance.at");
    pointer(subjectAt, "outcome.acceptance.subjectAt");
    if (at === subjectAt || at.startsWith(`${subjectAt}/`))
      throw new DefinitionError(
        "DEFINITION_INVALID",
        "outcome.acceptance.subjectAt",
        "The subject cannot contain its final acceptance reference.",
      );
    if (!criteria.length)
      throw new DefinitionError(
        "DEFINITION_INVALID",
        "outcome.acceptance.criteria",
        "At least one criterion is required.",
      );
    const ids = new Set<string>();
    for (const criterion of criteria) {
      checkId(criterion.id, "outcome.acceptance.criteria.id");
      if (ids.has(criterion.id))
        throw new DefinitionError(
          "DEFINITION_INVALID",
          "outcome.acceptance.criteria",
          `Duplicate criterion ${criterion.id}.`,
        );
      ids.add(criterion.id);
    }
  }
}
