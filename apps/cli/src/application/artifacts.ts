import * as z from "zod";
import type {
  ListPage,
  StorageQuery,
  StorageReadAccess,
  StoredArtifact,
} from "@intloom/kernel";
import { failure } from "../errors.ts";

export type ArtifactSelector =
  | {
      readonly artifactId: string;
      readonly flowName?: never;
      readonly stageName?: never;
    }
  | {
      readonly artifactId?: never;
      readonly flowName: string;
      readonly stageName: string;
    };
export type ArtifactQuery = Pick<
  StorageQuery,
  "flowName" | "stageName" | "limit" | "cursor"
>;
export type ArtifactSummary = Omit<StoredArtifact, "data">;

const name = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (value) =>
      value.trim().length > 0 &&
      !/[\uD800-\uDFFF]/u.test(value) &&
      !/\p{Cc}/u.test(value),
  );
export const artifactSelectorSchema = z
  .strictObject({
    artifactId: name.optional(),
    flowName: name.optional(),
    stageName: name.optional(),
  })
  .refine((value) =>
    value.artifactId !== undefined
      ? value.flowName === undefined && value.stageName === undefined
      : value.flowName !== undefined && value.stageName !== undefined,
  );
export const artifactQuerySchema = z.strictObject({
  flowName: name.optional(),
  stageName: name.optional(),
  limit: z.number().int().min(1).max(200).optional(),
  cursor: z.string().min(1).max(16384).optional(),
});
export const artifactSummarySchema = z.strictObject({
  id: name,
  flowName: name,
  stageName: name,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const storedArtifactSchema: z.ZodType<StoredArtifact> =
  artifactSummarySchema.extend({ data: z.json() });
export const artifactPageSchema = z
  .strictObject({
    data: z.array(artifactSummarySchema),
    nextCursor: z.string().optional(),
  })
  .transform(
    ({ data, nextCursor }): ListPage<ArtifactSummary> => ({
      data,
      ...(nextCursor === undefined ? {} : { nextCursor }),
    }),
  );

export function parseArtifactSelector(input: unknown): ArtifactSelector {
  const result = artifactSelectorSchema.safeParse(input);
  if (!result.success)
    throw failure(
      "INVALID_REQUEST",
      "Use an Artifact ID or both --flow and --stage. These lookup methods cannot be combined.",
      result.error,
    );
  const value = result.data;
  if (value.artifactId !== undefined) return { artifactId: value.artifactId };
  if (value.flowName !== undefined && value.stageName !== undefined)
    return { flowName: value.flowName, stageName: value.stageName };
  throw failure(
    "INVALID_REQUEST",
    "Artifact lookup requires an ID or a flow and stage.",
  );
}

export function parseArtifactQuery(input: unknown): ArtifactQuery {
  const result = artifactQuerySchema.safeParse(input);
  if (!result.success)
    throw failure(
      "INVALID_REQUEST",
      "Invalid Artifact list parameters; limit must be between 1 and 200.",
      result.error,
    );
  const { flowName, stageName, limit, cursor } = result.data;
  return {
    ...(flowName === undefined ? {} : { flowName }),
    ...(stageName === undefined ? {} : { stageName }),
    ...(limit === undefined ? {} : { limit }),
    ...(cursor === undefined ? {} : { cursor }),
  };
}

/** Reads the host's already-open Storage without requiring Workflow availability or advancing Runs. */
export async function getArtifact(
  storage: StorageReadAccess,
  input: ArtifactSelector,
): Promise<StoredArtifact | null> {
  const selector = parseArtifactSelector(input);
  return (
    (selector.artifactId !== undefined
      ? await storage.getArtifactById(selector.artifactId)
      : await storage.getArtifact(selector.flowName, selector.stageName)) ??
    null
  );
}

export async function listArtifacts(
  storage: StorageReadAccess,
  input: ArtifactQuery = {},
): Promise<ListPage<ArtifactSummary>> {
  const page = await storage.listArtifacts(parseArtifactQuery(input));
  return {
    data: page.data.map(({ data: _data, ...summary }) => summary),
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  };
}
