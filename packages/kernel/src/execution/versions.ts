import type { RunRecord } from "../lifecycle/run-contracts.ts";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as {
  version: string;
  dependencies: { "@mastra/core": string; "@mastra/libsql": string };
};

export const kernelVersion = manifest.version;
export const runtimeVersions = {
  kernel: kernelVersion,
  engine: manifest.dependencies["@mastra/core"],
  storage: manifest.dependencies["@mastra/libsql"],
};

export function effectiveRuntime(record: RunRecord) {
  const original = record.binding.runtime;
  return record.recoveredKernelVersion
    ? { ...original, version: record.recoveredKernelVersion }
    : original;
}
