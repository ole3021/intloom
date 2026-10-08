import { readFileSync } from "node:fs";

// src and dist are both one level below the owning package manifest, including .publish.
const manifest: { version?: unknown } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
if (typeof manifest.version !== "string" || !manifest.version)
  throw new Error("Missing CLI package version.");
export const packageVersion = manifest.version;
