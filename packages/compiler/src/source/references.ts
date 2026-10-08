import { isAbsolute, relative, resolve, sep } from "node:path";
import { fail } from "../errors.ts";

const kinds = {
  stages: "stage",
  agents: "agent",
  skills: "skill",
  codes: "code",
  schemas: "schema",
  tools: "tool",
  initializers: "initializer",
} as const;

export function isPathWithin(root: string, file: string): boolean {
  const path = relative(root, file);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export function resolveReference(root: string, reference: string) {
  const match =
    /^@(stages|agents|skills|codes|schemas|tools|initializers)\/([^:]+)(?::([A-Za-z_$][\w$]*))?$/.exec(
      reference,
    );
  if (!match)
    fail("INVALID_REFERENCE", `Invalid resource reference: ${reference}`);
  const directory = match[1] as keyof typeof kinds;
  const name = match[2] as string;
  const suffix =
    directory === "stages"
      ? ".yaml"
      : directory === "agents"
        ? ".md"
        : directory === "skills"
          ? "/SKILL.md"
          : ".ts";
  const file = resolve(
    root,
    directory,
    name.endsWith(suffix) ? name : `${name}${suffix}`,
  );
  if (
    !isPathWithin(resolve(root, directory), file) ||
    name.includes("\\") ||
    name.split("/").includes("..") ||
    file.endsWith(".d.ts")
  ) {
    fail(
      "INVALID_REFERENCE",
      `Resource must be a source file inside ${directory}: ${reference}`,
    );
  }
  if (["stages", "agents", "skills"].includes(directory) && match[3]) {
    fail(
      "INVALID_REFERENCE",
      `This resource has no module export selector: ${reference}`,
    );
  }
  return { file, kind: kinds[directory], exportName: match[3] ?? "default" };
}
