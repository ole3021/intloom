import { fileURLToPath } from "node:url";
import { failure } from "../../errors.ts";
import { projectRoot, readConnection } from "../../service/discovery.ts";
import { serviceUrl } from "../../service/contracts.ts";

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
  const root = await projectRoot(directory);
  const connection = await readConnection(root);
  if (!connection)
    throw failure(
      "CLI_SERVICE_OFFLINE",
      "Run intloom start before generating the Codex connection.",
    );
  const helper = [
    process.execPath,
    fileURLToPath(new URL("../../bin.js", import.meta.url)),
    "_auth-headers",
    "--project",
    root,
  ];
  return `[mcp_servers.intloom]\nurl = ${JSON.stringify(`${serviceUrl(connection)}/codex`)}\nhttp_headers_helper = ${JSON.stringify(headerCommand(helper))}\nstartup_timeout_sec = 20\ntool_timeout_sec = 300\n`;
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
