import type { CodeExecutionAccess, JsonValue } from "@intloom/loom-sdk";
import { writeFileSync } from "node:fs";

// The test checks this marker before importing the output in a separate process.
writeFileSync(new URL("../../module-loaded.txt", import.meta.url), "loaded");

export default async function run(access: CodeExecutionAccess<JsonValue>) {
  const value = access.state.value;
  await access.state.update({ value: String(value).toUpperCase() });
  return { outcome: "complete" };
}
