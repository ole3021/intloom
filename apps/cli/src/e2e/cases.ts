import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, copyFile } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { caseSchema, E2eError, type CaseManifest } from "./contracts.ts";
import { readYaml } from "./configuration.ts";

export const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export function localPath(root: string, path: string) {
  const target = resolve(root, path),
    local = relative(root, target);
  if (
    isAbsolute(path) ||
    !local ||
    local === ".." ||
    local.startsWith(`..${sep}`)
  )
    throw new E2eError(
      "CASE_PATH_INVALID",
      "Use relative paths inside the case or suite directory.",
      "scenario",
      "blocked",
    );
  return target;
}
export async function filesUnder(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(path: string) {
    const info = await lstat(path);
    if (info.isSymbolicLink())
      throw new E2eError(
        "CASE_PATH_INVALID",
        "Case and suite resources cannot contain symbolic links.",
        "scenario",
        "blocked",
      );
    if (info.isDirectory())
      for (const name of (await readdir(path)).sort())
        await walk(join(path, name));
    else if (info.isFile()) files.push(relative(root, path));
    else
      throw new E2eError(
        "CASE_PATH_INVALID",
        "Case resources must be ordinary files.",
        "scenario",
        "blocked",
      );
  }
  await walk(root);
  return files;
}
export async function catalog(root: string) {
  const ids: string[] = [];
  for (const name of (await readdir(root)).sort())
    if (
      /^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(name) &&
      (
        await lstat(join(root, name, "case.yaml")).catch(() => undefined)
      )?.isFile()
    )
      ids.push(name);
  if (
    !ids.length ||
    new Set(ids.map((id) => id.toLowerCase())).size !== ids.length
  )
    throw new E2eError(
      "CASE_INVALID",
      "Provide cases with unique IDs (ignoring case).",
      "scenario",
      "blocked",
    );
  return ids;
}
export async function loadCase(directory: string) {
  const files = await filesUnder(directory);
  const manifest = caseSchema.parse(
    await readYaml(join(directory, "case.yaml")),
  );
  if (manifest.id !== basename(directory))
    throw new E2eError(
      "CASE_INVALID",
      "Case ID and directory name must agree.",
      "scenario",
      "blocked",
    );
  for (const file of files) {
    if (
      file.startsWith(`workspace${sep}`) &&
      file
        .split(sep)
        .slice(1)
        .some(
          (p) =>
            [
              ".git",
              ".intloom",
              "intloom",
              "node_modules",
              "intloom.yaml",
              ".codex",
            ].includes(p) || /^\.env(?:\.|$)/u.test(p),
        )
    )
      throw new E2eError(
        "CASE_PATH_INVALID",
        "Workspace fixtures cannot contain credentials, runtime state or IntLoom configuration.",
        "scenario",
        "blocked",
      );
  }
  const common = files.includes("knowledge.md")
    ? await readFile(join(directory, "knowledge.md"), "utf8")
    : "";
  const knowledge: string[] = [];
  for (const round of manifest.rounds)
    knowledge.push(
      round.knowledge
        ? await readFile(localPath(directory, round.knowledge), "utf8")
        : "",
    );
  const identities = await Promise.all(
    files.map(async (path) => ({
      path,
      digest: digest(await readFile(join(directory, path))),
    })),
  );
  return {
    manifest,
    directory,
    common,
    knowledge,
    files: identities,
    digest: digest(JSON.stringify(identities)),
  };
}
export type CaseData = Awaited<ReturnType<typeof loadCase>>;
export async function selectCase(
  root: string,
  caseId: string | undefined,
  seed: string,
) {
  const candidates = await catalog(root);
  const id = caseId
    ? candidates.find((id) => id.toLowerCase() === caseId.toLowerCase())
    : candidates[
        Number.parseInt(digest(seed).slice(0, 12), 16) % candidates.length
      ];
  if (!id)
    throw new E2eError(
      "CASE_NOT_FOUND",
      "The requested case does not exist.",
      "scenario",
      "blocked",
    );
  return {
    data: await loadCase(join(root, id)),
    candidates,
    seed,
    random: caseId === undefined,
  };
}
export function roundKnowledge(data: CaseData, index: number) {
  const content = [data.common, ...data.knowledge.slice(0, index + 1)]
    .filter(Boolean)
    .join("\n\n");
  const ids = [...content.matchAll(/^## (?<id>K[0-9]+)\b/gm)].flatMap(
    (m) => m.groups?.id ?? [],
  );
  if (new Set(ids).size !== ids.length)
    throw new E2eError(
      "CASE_INVALID",
      "Active knowledge section IDs must be unique.",
      "scenario",
      "blocked",
    );
  return { content, ids: ids.length ? ids : ["knowledge"] };
}
export async function copyCase(data: CaseData, target: string) {
  for (const file of data.files) {
    const source = join(data.directory, file.path);
    if (digest(await readFile(source)) !== file.digest)
      throw new E2eError(
        "CASE_CHANGED",
        "The case changed during preparation.",
        "scenario",
        "blocked",
      );
    const destination = join(target, file.path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination, 1);
  }
}
export async function roundInput(
  manifest: CaseManifest,
  index: number,
  project: string,
) {
  const round = manifest.rounds[index];
  if (!round)
    throw new E2eError(
      "CASE_INVALID",
      "Round index is out of range.",
      "scenario",
      "blocked",
    );
  const input = structuredClone(round.input);
  for (const kind of ["files", "dirs"] as const)
    if (input[kind]) {
      input[kind] = await Promise.all(
        input[kind].map(async (path) => {
          const target = localPath(project, path);
          // Check every component, including parents, before exposing the fixture path.
          let current = project;
          for (const part of relative(project, target).split(sep)) {
            current = join(current, part);
            if ((await lstat(current)).isSymbolicLink())
              throw new E2eError(
                "CASE_PATH_INVALID",
                "Input references cannot traverse symbolic links.",
                "scenario",
              );
          }
          const info = await lstat(target);
          if (kind === "files" ? !info.isFile() : !info.isDirectory())
            throw new E2eError(
              "CASE_PATH_INVALID",
              `Expected ${kind}: ${path}`,
              "scenario",
            );
          return target;
        }),
      );
    }
  return input;
}
