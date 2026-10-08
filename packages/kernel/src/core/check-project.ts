import { realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { LoomConfig } from "./schemas/loom-config.ts";
import { KERNEL_ERRORS } from "../errors/kernel.ts";
import { loadConfig } from "./load-config.ts";

export interface CheckedProject {
  readonly projectRoot: string;
  readonly config: LoomConfig;
}

/** Normalizes the path and validates the fixed project configuration before Workflow loading. */
export async function checkProject(
  projectRoot: string,
): Promise<CheckedProject> {
  if (typeof projectRoot !== "string" || !projectRoot.trim())
    throw KERNEL_ERRORS.create("INVALID_REQUEST", {
      message: "A project root must contain non-whitespace text.",
    });
  let root: string;
  try {
    root = await realpath(resolve(projectRoot));
    if (!(await stat(root)).isDirectory())
      throw KERNEL_ERRORS.create("INVALID_REQUEST", {
        message: "The project root must be a directory.",
      });
    if (!(await stat(resolve(root, "intloom.yaml"))).isFile())
      throw KERNEL_ERRORS.create("INVALID_REQUEST", {
        message: "The project must have an intloom.yaml file.",
      });
  } catch (cause) {
    if (KERNEL_ERRORS.is(cause)) throw cause;
    const missing =
      cause instanceof Error && "code" in cause && cause.code === "ENOENT";
    throw KERNEL_ERRORS.wrap(
      missing ? "NOT_FOUND" : "KERNEL_UNAVAILABLE",
      cause,
      {
        message: "Cannot access the project root or its intloom.yaml entry.",
      },
    );
  }
  return { projectRoot: root, config: await loadConfig(root) };
}
