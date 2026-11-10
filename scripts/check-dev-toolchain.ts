import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { satisfies } from "semver";

const { engines } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { engines: { node: string; bun: string } };
const bunVersion = execFileSync("bun", ["--version"], {
  encoding: "utf8",
}).trim();

if (
  !satisfies(process.versions.node, engines.node) ||
  !satisfies(bunVersion, engines.bun)
) {
  process.stderr.write(
    `Required Node ${engines.node} and Bun ${engines.bun}; received Node ${process.versions.node} and Bun ${bunVersion}. Select the Node version in .node-version before running verification.\n`,
  );
  process.exitCode = 1;
}
