import { startProjectHost, type ProjectHost } from "./host.ts";
import { errorView } from "../errors.ts";
import { basename } from "node:path";

import { installFatalLogging } from "./fatal-logging.ts";

let removeFatalLogging: (() => void) | undefined;
let host: ProjectHost | undefined;
let requestedStop = false;
async function close() {
  requestedStop = true;
  try {
    await host?.close();
  } catch {
    process.exitCode = 1;
  } finally {
    removeFatalLogging?.();
  }
}
process.once("SIGTERM", () => {
  void close();
});
process.once("SIGINT", () => {
  void close();
});
try {
  host = await startProjectHost(
    JSON.parse(process.argv[2] ?? "null"),
    (filePath, logs) => {
      removeFatalLogging = installFatalLogging(logs);
      process.send?.({ logFile: basename(filePath) });
    },
  );
  if (requestedStop) await close();
  else process.send?.(host.info);
} catch (error) {
  process.send?.(errorView(error));
  process.exitCode = 1;
}
// IPC is used only for initial readiness; the service retains its execution environment after disconnection.
if (requestedStop || !host) {
  removeFatalLogging?.();
  process.disconnect?.();
}
