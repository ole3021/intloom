import { execFileSync } from "node:child_process";
import { join } from "node:path";

if (process.platform === "darwin") {
  process.env.PATH = `${join(import.meta.dirname, "macos")}:${process.env.PATH}`;
}
execFileSync("bun", ["run", "electrobun", "build", "--env=stable"], {
  stdio: "inherit",
});
