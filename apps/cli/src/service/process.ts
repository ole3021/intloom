import { progress } from "../ui/live.ts";
import { startLocalService } from "./start.ts";

export function ensureService(
  dataDir: string,
  animated = true,
  mcpPort?: number,
) {
  return startLocalService(dataDir, mcpPort, () =>
    progress("Starting Intloom service", "starting", animated),
  );
}
