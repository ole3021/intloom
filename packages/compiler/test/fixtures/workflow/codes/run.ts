import { writeFileSync } from "node:fs";

// The test checks this marker before importing the output in a separate process.
writeFileSync(new URL("../../module-loaded.txt", import.meta.url), "loaded");

export default async function run(value: string) {
  return { outcome: "complete", value: value.toUpperCase() };
}
