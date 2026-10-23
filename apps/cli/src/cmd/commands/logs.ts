import type { CmdContext } from "../context.ts";
import { bool, pos, invalid, value } from "../arguments.ts";
import { observing } from "../observe.ts";
export function createLogsCommands(context: CmdContext) {
  const { core, common, print, leaf } = context;
  return {
    logs: leaf(
      "Read logs; optionally follow Service files",
      {
        runId: pos("Optional Run ID", false),
        service: bool("Latest log"),
        follow: bool("Observe until interrupted"),
      },
      async (a, p) => {
        if (a.runId && a.service) invalid("Use Run ID or --service.");
        const request = {
          ...p,
          ...(a.runId ? { runId: value(a, "runId", true) } : {}),
          level: common.debug ? ("debug" as const) : ("info" as const),
        };
        if (!a.follow) {
          print(await core.readLogs(request));
          return;
        }
        const observer = observing();
        try {
          for await (const result of core.watchLogs(request, {
            signal: observer.controller.signal,
          }))
            print(result);
        } finally {
          observer.close();
        }
      },
    ),
  };
}
