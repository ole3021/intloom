import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "smol-toml";
import { projectRoot } from "@intloom/kernel/host";
import { failure } from "../../errors.ts";

const begin = "# BEGIN INTLOOM MCP";
const end = "# END INTLOOM MCP";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export interface McpConfigInput {
  readonly projectPath: string;
  readonly ide: "codex";
}
export interface McpConfigPlan {
  readonly ide: "codex";
  readonly projectRoot: string;
  readonly targetPath: string;
  readonly status: "create" | "update" | "unchanged" | "conflict";
  readonly beforeHash: string;
  readonly snippet: string;
}
async function readTarget(filename: string) {
  const info = await lstat(filename).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  });
  if (info && !info.isFile())
    throw failure(
      "MCP_CONFIG_INVALID",
      "MCP configuration must be an ordinary file.",
    );
  return info ? await readFile(filename, "utf8") : "";
}
export async function planMcpConfig(
  input: McpConfigInput,
): Promise<McpConfigPlan> {
  if (input.ide !== "codex")
    throw failure(
      "INVALID_REQUEST",
      "This release supports the Codex MCP profile.",
    );
  const root = await projectRoot(input.projectPath);
  const targetPath = join(root, ".codex", "config.toml");
  const original = await readTarget(targetPath);
  let current: unknown;
  try {
    current = parse(original);
  } catch {
    throw failure(
      "MCP_CONFIG_INVALID",
      "The existing Codex configuration is invalid TOML; no file was changed.",
    );
  }
  const snippet = `[mcp_servers.intloom]\ncommand = ${JSON.stringify(process.execPath)}\nargs = ${JSON.stringify([fileURLToPath(new URL("../../bin.js", import.meta.url)), "mcp", "serve", "--project", root, "--ide", "codex"])}\ncwd = ${JSON.stringify(root)}\nstartup_timeout_sec = 20\ntool_timeout_sec = 300\n`;
  const servers =
    current && typeof current === "object" && "mcp_servers" in current
      ? current.mcp_servers
      : undefined;
  const existing =
    servers &&
    typeof servers === "object" &&
    !Array.isArray(servers) &&
    "intloom" in servers
      ? servers.intloom
      : undefined;
  const desired = parse(snippet).mcp_servers;
  const same =
    JSON.stringify(existing) ===
    JSON.stringify(
      desired &&
        typeof desired === "object" &&
        !Array.isArray(desired) &&
        "intloom" in desired
        ? desired.intloom
        : undefined,
    );
  const managed =
    original.includes(begin) &&
    original.includes(end) &&
    original.indexOf(end) > original.indexOf(begin);
  const status = same
    ? "unchanged"
    : existing
      ? managed
        ? "update"
        : "conflict"
      : "create";
  return {
    ide: input.ide,
    projectRoot: root,
    targetPath,
    status,
    beforeHash: hash(original),
    snippet,
  };
}
/** Recompute trusted paths/content and compare the reviewed file; never accepts an arbitrary target or token. */
export async function applyMcpConfig(
  input: McpConfigInput & { readonly beforeHash: string },
) {
  const plan = await planMcpConfig(input);
  if (plan.beforeHash !== input.beforeHash)
    throw failure(
      "CONFLICT",
      "Codex configuration changed since planning; inspect a new plan.",
    );
  if (plan.status === "conflict")
    throw failure(
      "MCP_CONFIG_CONFLICT",
      "An unmanaged IntLoom MCP entry already exists. Resolve it before applying this plan.",
    );
  if (plan.status === "unchanged")
    return { ...plan, status: "unchanged" as const };
  const folder = join(plan.projectRoot, ".codex");
  await mkdir(folder, { recursive: true });
  if (!(await lstat(folder)).isDirectory())
    throw failure(
      "MCP_CONFIG_INVALID",
      "The project .codex directory cannot be a symlink.",
    );
  const original = await readTarget(plan.targetPath);
  if (hash(original) !== plan.beforeHash)
    throw failure(
      "CONFLICT",
      "Codex configuration changed; no update was applied.",
    );
  const block = `${begin}\n${plan.snippet}${end}`;
  const first = original.indexOf(begin),
    last = original.indexOf(end);
  const next =
    first >= 0 && last > first
      ? original.slice(0, first) + block + original.slice(last + end.length)
      : `${original}${original.endsWith("\n") || !original ? "" : "\n"}\n${block}\n`;
  // Validate the whole merged document before publishing it.
  try {
    parse(next);
  } catch {
    throw failure(
      "MCP_CONFIG_INVALID",
      "The proposed merged configuration is invalid; no update was applied.",
    );
  }
  const temporary = join(folder, `.intloom-${randomUUID()}.tmp`);
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(next);
      await file.sync();
    } finally {
      await file.close();
    }
    if (hash(await readTarget(plan.targetPath)) !== plan.beforeHash)
      throw failure(
        "CONFLICT",
        "Codex configuration changed; its concurrent edit was preserved.",
      );
    await rename(temporary, plan.targetPath);
  } finally {
    await rm(temporary, { force: true });
  }
  return {
    ...plan,
    status:
      plan.status === "create" ? ("created" as const) : ("updated" as const),
  };
}
