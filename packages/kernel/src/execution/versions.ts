import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as {
  version: string;
  dependencies: { "@mastra/core": string; "@mastra/libsql": string };
};

export const runtimeVersions = {
  kernel: manifest.version,
  engine: manifest.dependencies["@mastra/core"],
  storage: manifest.dependencies["@mastra/libsql"],
};
