import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { ERRORS } from "../../errors.ts";

export type CredentialResolver = (reference: string) => string | undefined;

/** Keeps file credentials local to this project and loads them only when needed. */
export function createCredentialResolver(
  projectRoot?: string,
  environment: NodeJS.ProcessEnv = process.env,
): CredentialResolver {
  let fileEnvironment: NodeJS.ProcessEnv | undefined;
  return (reference) => {
    const variable = reference.slice(reference.indexOf(".") + 1);
    const value = environment[variable];
    if (value !== undefined || !reference.startsWith("ENV.") || !projectRoot)
      return value;
    if (!fileEnvironment) {
      try {
        const path = join(projectRoot, ".env");
        if (!lstatSync(path).isFile()) throw new Error("Not a regular file");
        fileEnvironment = parseEnv(readFileSync(path, "utf8"));
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === "ENOENT")
          fileEnvironment = {};
        else
          throw ERRORS.create("INVALID_REQUEST", {
            message: "Cannot read the project's .env as a regular dotenv file.",
          });
      }
    }
    return Object.hasOwn(fileEnvironment, variable)
      ? fileEnvironment[variable]
      : undefined;
  };
}
