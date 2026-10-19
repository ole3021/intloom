import { failure } from "../../errors.ts";
import { projectRoot, readConnection } from "@intloom/kernel/host";

export async function authHeaders(directory: string) {
  const root = await projectRoot(directory);
  const connection = await readConnection(root);
  if (!connection)
    throw failure(
      "CLI_SERVICE_OFFLINE",
      "Start this project service before generating authorization headers.",
    );
  return { Authorization: `Bearer ${connection.token}` };
}

/** Generates a project configuration snippet only; the private token is read at runtime and excluded from Codex configuration. */
export async function codexConfiguration(directory: string) {
  const { planMcpConfig } = await import("../../core/project/mcp-config.ts");
  return (await planMcpConfig({ projectPath: directory, ide: "codex" }))
    .snippet;
}

/** Codex accepts a command string; escape shell arguments before the caller encodes TOML. */
export function headerCommand(
  args: readonly string[],
  platform = process.platform,
) {
  if (platform === "win32") {
    const script = `& ${args.map((arg) => `'${arg.replaceAll("'", "''")}'`).join(" ")}; exit $LASTEXITCODE`;
    return `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(script, "utf16le").toString("base64")}`;
  }
  return args.map((arg) => `'${arg.replaceAll("'", "'\\''")}'`).join(" ");
}
