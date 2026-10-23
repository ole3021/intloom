import { createHash, randomUUID } from "node:crypto";
import { lstat, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { loomConfigSchema } from "@intloom/kernel/host";
import { failure } from "../../errors.ts";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function document(text: string) {
  const parsed = parseDocument(text, { uniqueKeys: true, prettyErrors: false });
  if (parsed.errors.length || parsed.warnings.length)
    throw failure(
      "INVALID_REQUEST",
      "Project configuration must be valid YAML.",
    );
  const value: unknown = parsed.toJS({ maxAliasCount: 0 });
  loomConfigSchema.parse(value);
  return value;
}
function redact(value: unknown): unknown {
  if (typeof value === "string" && /^https?:\/\//u.test(value)) {
    try {
      const url = new URL(value);
      if (url.username || url.password) {
        url.username = "";
        url.password = "";
      }
      for (const key of url.searchParams.keys())
        if (/secret|token|password|api.?key/iu.test(key))
          url.searchParams.set(key, "[redacted]");
      return url.href;
    } catch {
      return "[invalid_url]";
    }
  }
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /secret|token|password|api.?key|authorization/iu.test(key)
        ? "[redacted]"
        : redact(item),
    ]),
  );
}
export async function readProjectConfig(root: string) {
  const text = await readFile(join(root, "intloom.yaml"), "utf8");
  return {
    projectRoot: root,
    revision: hash(text),
    configuration: redact(document(text)),
  };
}
export async function updateProjectConfig(
  root: string,
  text: string,
  expectedRevision: string,
) {
  document(text);
  const filename = join(root, "intloom.yaml");
  const info = await lstat(filename);
  if (!info.isFile())
    throw failure(
      "CLI_PROJECT_INVALID",
      "Project configuration must be an ordinary file.",
    );
  const previous = await readFile(filename, "utf8");
  if (hash(previous) !== expectedRevision)
    throw failure(
      "CONFLICT",
      "Project configuration changed; inspect its current revision before updating.",
    );
  const temporary = join(root, `.intloom-config-${randomUUID()}.tmp`);
  try {
    const file = await open(temporary, "wx", info.mode & 0o777);
    try {
      await file.writeFile(text);
      await file.sync();
    } finally {
      await file.close();
    }
    if ((await readFile(filename, "utf8")) !== previous)
      throw failure(
        "CONFLICT",
        "A concurrent configuration edit was preserved.",
      );
    await rename(temporary, filename);
  } finally {
    await rm(temporary, { force: true });
  }
  return {
    projectRoot: root,
    revision: hash(text),
    effective: "next_service_start" as const,
  };
}
