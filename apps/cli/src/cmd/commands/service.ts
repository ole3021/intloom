import type { CmdContext } from "../context.ts";
import { str, instanceFlag, integer } from "../arguments.ts";
export function createServiceCommands(context: CmdContext) {
  const { core, print, instance, leaf } = context;
  return {
    start: leaf(
      "Start or reuse Service",
      { port: str("Local port 0–65535") },
      async (a, p) => {
        const port = integer(a, "port", 65535);
        print(
          await core.startService({
            ...p,
            ...(port === undefined ? {} : { port }),
          }),
        );
      },
    ),
    stop: leaf("Stop and verify resource release", instanceFlag, async (a, p) =>
      print(await core.stopService(instance(p, a))),
    ),
    status: leaf("Verified Service status", {}, async (_a, p) =>
      print(await core.getServiceStatus(p)),
    ),
  };
}
