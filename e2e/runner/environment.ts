import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { E2eError } from "./contracts.ts";
import { repositoryRoot } from "./options.ts";

/** E2E credentials belong to the IntLoom checkout, not its generated projects. */
export function loadEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  projectRoot: string = repositoryRoot,
): NodeJS.ProcessEnv {
  let fileEnvironment: NodeJS.ProcessEnv = {};
  try {
    const path = join(projectRoot, ".env");
    if (!lstatSync(path).isFile()) throw new Error("Not a regular file");
    fileEnvironment = parseEnv(readFileSync(path, "utf8"));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT")
      throw new E2eError(
        "PROJECT_ENV_UNREADABLE",
        "Cannot read the IntLoom checkout's .env as a regular dotenv file.",
        "environment",
        "blocked",
      );
  }
  return {
    ...fileEnvironment,
    ...Object.fromEntries(
      Object.entries(environment).filter(([, value]) => value !== undefined),
    ),
  };
}
