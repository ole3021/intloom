import { realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Tests inject an isolated service directory without adding a public CLI option.
export function cliArgs(binary, serviceDir, ...args) {
  return [fileURLToPath(import.meta.url), binary, serviceDir, ...args];
}
export async function shutdown(binary, serviceDir) {
  const directory = dirname(
    createRequire(await realpath(binary)).resolve("@intloom/cli/bin"),
  );
  const { requestService } = await import(
    pathToFileURL(join(directory, "service/client.js")).href
  );
  return requestService(serviceDir, "serviceShutdown");
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , binary, serviceDir, ...args] = process.argv;
  const { runCli } = await import(
    pathToFileURL(
      join(
        dirname(
          createRequire(await realpath(binary)).resolve("@intloom/cli/bin"),
        ),
        "commands.js",
      ),
    ).href
  );
  await runCli(args, { serviceDir, mcpPort: 0 });
}
