import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import {
  withTempDir,
  type CodeContext,
  type FileTools,
  type ReadonlyData,
} from "@intloom/loom-sdk";
import type { z } from "zod";
import type {
  Baseline,
  Configuration,
  Files,
  Receipt,
  Specification,
  opinion,
  patch,
} from "./schemas.ts";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function digest(files: Files) {
  return hash(
    JSON.stringify(
      files
        .map((file) => [file.path, file.content] as const)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  );
}

function safePath(path: string) {
  if (
    path
      .split("/")
      .some((part) => !part || part.startsWith(".") || /[\\\0:]/.test(part))
  ) {
    throw new Error("Expected a relative, non-hidden project path");
  }
}

export async function capture(
  projectDir: string,
  prompt: string,
  config: Configuration,
  fs: FileTools,
): Promise<Baseline> {
  if (
    (await fs.stat({ path: projectDir, followSymlinks: true }))?.type !==
    "directory"
  )
    throw new Error("A project directory is required");
  if (
    new Set(config.files.map((file) => file.path)).size !==
      config.files.length ||
    new Set(config.checks.map((check) => check.id)).size !==
      config.checks.length ||
    config.checks.some((check) => check.id === "protected-files")
  ) {
    throw new Error("Duplicate path or duplicate/reserved check ID");
  }
  const files: { path: string; editable: boolean; content: string | null }[] =
    [];
  for (const file of config.files) {
    safePath(file.path);
    let path = projectDir;
    let missing = false;
    const parts = file.path.split("/");
    for (const [index, part] of parts.entries()) {
      path = join(path, part);
      const info = await fs.stat({ path, followSymlinks: false });
      if (!info) {
        missing = true;
        break;
      }
      if (info.type !== (index === parts.length - 1 ? "file" : "directory")) {
        throw new Error("Only regular project files are supported");
      }
    }
    if (missing && !file.editable) throw new Error("Missing protected file");
    const content = missing ? null : await fs.read({ path });
    files.push({ ...file, content });
  }
  return {
    prompt,
    checks: config.checks,
    files,
    protectedHashes: files.flatMap((file) =>
      !file.editable && file.content !== null
        ? [{ path: file.path, sha256: hash(file.content) }]
        : [],
    ),
  };
}

export function applyEdits(
  base: Files,
  allowed: readonly string[],
  edits: ReadonlyData<z.infer<typeof patch>["edits"]>,
): Files {
  const byPath = new Map(edits.map((edit) => [edit.path, edit.content]));
  if (byPath.size !== edits.length) throw new Error("INTENT_DUPLICATE_EDIT");
  if (
    edits.some(
      (edit) =>
        !allowed.includes(edit.path) ||
        !base.some((file) => file.editable && file.path === edit.path),
    )
  ) {
    throw new Error("INTENT_EDIT_OUT_OF_SCOPE");
  }
  return base.map((file) => {
    const content = byPath.get(file.path);
    return { ...file, content: content === undefined ? file.content : content };
  });
}

export async function materialize(
  directory: string,
  files: Files,
  fs: FileTools,
) {
  for (const file of files) {
    if (file.content === null) continue;
    const path = join(directory, file.path);
    await fs.mkdir({ path: dirname(path) });
    await fs.write({ path, content: file.content });
  }
}

export function checksFor(base: Baseline) {
  const checks = [...base.checks];
  if (base.protectedHashes.length)
    checks.push({
      id: "protected-files",
      description:
        "All protected files remain byte-identical to the input baseline.",
      command: process.execPath,
      args: [
        "-e",
        "const fs=require('node:fs'),c=require('node:crypto');for(const f of JSON.parse(process.argv[1]))if(c.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex')!==f.sha256)process.exit(1);console.log('Protected SHA-256 checks passed')",
        JSON.stringify(base.protectedHashes),
      ],
    });
  return checks;
}

export async function verify(
  files: Files,
  base: Baseline,
  context: CodeContext & { readonly tempDir: string },
): Promise<Receipt[]> {
  const receipts: Receipt[] = [];
  const candidate = digest(files);
  for (const check of checksFor(base)) {
    receipts.push(
      await withTempDir(context, async (directory) => {
        await materialize(directory, files, context.fs);
        const execution = await context.process.run({
          command: check.command,
          args: check.args,
          cwd: directory,
          timeoutMs: 30_000,
          maxOutputBytes: 16_000,
        });
        return {
          ...execution,
          id: check.id,
          candidate,
          attemptId: randomUUID(),
        };
      }),
    );
  }
  return receipts;
}

export function assess(
  criterion: Specification["criteria"][number],
  receipts: readonly Receipt[],
  view: z.infer<typeof opinion>,
) {
  const linked = criterion.checks.map((id) =>
    receipts.find((receipt) => receipt.id === id),
  );
  const failed = linked.find(
    (receipt) => receipt?.status === "exited" && receipt.exitCode !== 0,
  );
  let { verdict, reason } = view;
  if (failed) {
    verdict = "failed";
    reason = `Check ${failed.id} exited with code ${failed.exitCode}.`;
  } else if (
    !linked.length ||
    linked.some((receipt) => receipt?.status !== "exited")
  ) {
    verdict = "unverified";
    reason = "The criterion lacks completed check evidence.";
  }
  return {
    ...criterion,
    verdict,
    reason,
    modelVerdict: view.verdict,
    modelReason: view.reason,
  };
}
