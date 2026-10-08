import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { ReadonlyJsonValue } from "../../shared/json.ts";

export const projects = sqliteTable(
  "storage_projects",
  {
    projectId: text("project_id").primaryKey(),
    revision: integer("revision").notNull().default(0),
  },
  (table) => [
    check(
      "project_revision_range",
      sql`${table.revision} >= 0 AND ${table.revision} <= 9007199254740991`,
    ),
  ],
);

const columns = () => ({
  projectId: text("project_id")
    .notNull()
    .references(() => projects.projectId),
  id: text("id").notNull(),
  flowName: text("flow_name").notNull(),
  stageName: text("stage_name").notNull(),
  data: text("data", { mode: "json" }).$type<ReadonlyJsonValue>().notNull(),
  createdAt: text("created_at").notNull(),
});
export const artifacts = sqliteTable(
  "artifacts",
  {
    ...columns(),
    revision: integer("revision").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.id] }),
    uniqueIndex("artifact_stage").on(
      table.projectId,
      table.flowName,
      table.stageName,
    ),
    index("artifact_created").on(table.projectId, table.createdAt, table.id),
    check(
      "artifact_revision_range",
      sql`${table.revision} > 0 AND ${table.revision} <= 9007199254740991`,
    ),
    check("artifact_json", sql`json_valid(${table.data})`),
  ],
);
export const records = sqliteTable("records", columns(), (table) => [
  primaryKey({ columns: [table.projectId, table.id] }),
  index("record_created").on(table.projectId, table.createdAt, table.id),
  index("record_stage_created").on(
    table.projectId,
    table.flowName,
    table.stageName,
    table.createdAt,
    table.id,
  ),
  check("record_json", sql`json_valid(${table.data})`),
]);
