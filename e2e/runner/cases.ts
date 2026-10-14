import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  copyFile,
} from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { parseDocument } from "yaml";
import { caseSchema, E2eError, type CaseManifest } from "./contracts.ts";

export interface CaseData {
  manifest: CaseManifest;
  directory: string;
  intent: string;
  knowledge: string;
  knowledgeIds: string[];
  files: { path: string; digest: string }[];
  digest: string;
}
export function digest(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
export async function filesUnder(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(path: string) {
    const info = await lstat(path);
    if (info.isSymbolicLink())
      throw new E2eError(
        "CASE_PATH_INVALID",
        "Case files cannot contain symbolic links.",
        "scenario",
        "blocked",
      );
    if (info.isDirectory()) {
      for (const name of (await readdir(path)).sort())
        await walk(join(path, name));
    } else if (info.isFile()) files.push(relative(root, path));
    else
      throw new E2eError(
        "CASE_PATH_INVALID",
        "Case files must be regular files.",
        "scenario",
        "blocked",
      );
  }
  await walk(root);
  return files;
}
export async function loadCase(directory: string): Promise<CaseData> {
  const files = await filesUnder(directory);
  const yaml = parseDocument(
    await readFile(join(directory, "case.yaml"), "utf8"),
    { uniqueKeys: true },
  );
  if (yaml.errors.length)
    throw new E2eError(
      "CASE_INVALID",
      "The case manifest is invalid YAML.",
      "scenario",
      "blocked",
    );
  const manifest = caseSchema.parse({
    id: basename(directory),
    ...yaml.toJS(),
  });
  if (manifest.id !== basename(directory))
    throw new E2eError(
      "CASE_INVALID",
      "Case ID and directory name must agree.",
      "scenario",
      "blocked",
    );
  const intent = manifest.intents[0] as string;
  const knowledge = await readFile(join(directory, "knowledge.md"), "utf8");
  const knowledgeIds = [...knowledge.matchAll(/^## (K[0-9]+)\b/gm)].map(
    (match) => match[1] as string,
  );
  if (!knowledge.trim() || new Set(knowledgeIds).size !== knowledgeIds.length)
    throw new E2eError(
      "CASE_INVALID",
      "Cases need nonempty knowledge; numbered sections, when used, must be unique.",
      "scenario",
      "blocked",
    );
  for (const path of files.filter((file) =>
    file.startsWith(`workspace${sep}`),
  )) {
    const businessPath = path.slice("workspace".length + 1);
    if (
      businessPath
        .split(sep)
        .some((part) =>
          [".git", ".intloom", "intloom", "node_modules", ".codex"].includes(
            part,
          ),
        ) ||
      /^(?:intloom\.yaml|\.env(?:\.|$))/u.test(businessPath)
    )
      throw new E2eError(
        "CASE_PATH_INVALID",
        "Case workspace files cannot contain configuration, credentials or IntLoom data.",
        "scenario",
        "blocked",
      );
  }
  const identities = await Promise.all(
    files.map(async (path) => ({
      path,
      digest: digest(await readFile(join(directory, path))),
    })),
  );
  return {
    manifest,
    directory,
    intent,
    knowledge,
    knowledgeIds: knowledgeIds.length ? knowledgeIds : ["knowledge"],
    files: identities,
    digest: digest(JSON.stringify(identities)),
  };
}
export async function selectCase(
  root: string,
  caseId: string | undefined,
  seed: string,
) {
  root = await realpath(root);
  const candidates: string[] = [];
  for (const name of (await readdir(root)).sort())
    if (
      /^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(name) &&
      (
        await lstat(join(root, name, "case.yaml")).catch(() => undefined)
      )?.isFile()
    )
      candidates.push(name);
  if (!candidates.length)
    throw new E2eError(
      "CASE_NOT_FOUND",
      "The case library is empty.",
      "scenario",
      "blocked",
    );
  if (
    new Set(candidates.map((name) => name.toLowerCase())).size !==
    candidates.length
  )
    throw new E2eError(
      "CASE_INVALID",
      "Case IDs must be unique ignoring case.",
      "scenario",
      "blocked",
    );
  const id = caseId
    ? candidates.find((name) => name.toLowerCase() === caseId.toLowerCase())
    : candidates[
        Number.parseInt(digest(seed).slice(0, 12), 16) % candidates.length
      ];
  if (!id || !candidates.includes(id))
    throw new E2eError(
      "CASE_NOT_FOUND",
      "The requested case does not exist; no random fallback was used.",
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
export async function copyCase(data: CaseData, target: string) {
  for (const file of data.files) {
    const source = join(data.directory, file.path);
    const bytes = await readFile(source);
    if (digest(bytes) !== file.digest)
      throw new E2eError(
        "CASE_CHANGED",
        "The selected case changed during execution preparation.",
        "scenario",
        "blocked",
      );
    const destination = join(target, file.path);
    await mkdir(resolve(destination, ".."), { recursive: true, mode: 0o700 });
    await copyFile(source, destination, 1);
  }
}
