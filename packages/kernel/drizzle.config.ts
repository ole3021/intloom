import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/storage/sqlite/schema.ts",
  out: "./migrations/storage-sqlite",
});
