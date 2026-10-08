import { and, eq, gt, inArray, lt, or, type SQL } from "drizzle-orm";
import type { PreparedQuery } from "../query.ts";
import { artifactSchema, recordSchema } from "../schemas.ts";
import type { StoredArtifact, StoredRecord } from "../types.ts";
import { artifacts, records } from "./schema.ts";

export const artifactKey = (projectId: string, id: string) =>
  and(eq(artifacts.projectId, projectId), eq(artifacts.id, id));
export const recordKey = (projectId: string, id: string) =>
  and(eq(records.projectId, projectId), eq(records.id, id));

export function readArtifact(
  row: typeof artifacts.$inferSelect,
): StoredArtifact {
  const { projectId: _, ...entry } = row;
  return artifactSchema.parse(entry);
}
export function readRecord(row: typeof records.$inferSelect): StoredRecord {
  const { projectId: _, ...entry } = row;
  return recordSchema.parse(entry);
}
export function queryConditions(
  table: typeof artifacts | typeof records,
  projectId: string,
  query: PreparedQuery,
): SQL | undefined {
  const conditions = [eq(table.projectId, projectId)];
  if (query.flowName !== undefined)
    conditions.push(eq(table.flowName, query.flowName));
  if (query.stageName !== undefined)
    conditions.push(eq(table.stageName, query.stageName));
  if (query.ids !== undefined) conditions.push(inArray(table.id, query.ids));
  if (query.createdAfter !== undefined)
    conditions.push(gt(table.createdAt, query.createdAfter));
  if (query.createdBefore !== undefined)
    conditions.push(lt(table.createdAt, query.createdBefore));
  if (query.after) {
    const compare = query.order === "created_asc" ? gt : lt;
    const after = or(
      compare(table.createdAt, query.after.createdAt),
      and(
        eq(table.createdAt, query.after.createdAt),
        compare(table.id, query.after.id),
      ),
    );
    if (after) conditions.push(after);
  }
  return and(...conditions);
}
