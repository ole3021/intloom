import { readFileSync } from "node:fs";
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string; dependencies: { "@intloom/loom-sdk": string } };
export const { version } = manifest;
// Bun resolves workspace ranges when packing; during development read the linked SDK.
export const frameworkVersion =
  manifest.dependencies["@intloom/loom-sdk"] === "workspace:*"
    ? (JSON.parse(
        readFileSync(
          new URL("../../../packages/loom-sdk/package.json", import.meta.url),
          "utf8",
        ),
      ).version as string)
    : manifest.dependencies["@intloom/loom-sdk"];
export const cliName =
  process.env.INTLOOM_CLI_NAME === "intloom-dev" ? "intloom-dev" : "intloom";
