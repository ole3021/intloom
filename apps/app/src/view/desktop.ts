import type { DesktopApi } from "../shared/types";
import type { StudioRPC } from "../shared/rpc";
export async function connect(): Promise<DesktopApi> {
  if (import.meta.env.DEV && !window.__electrobun)
    return (await import("../mock/preview")).preview();
  const { Electroview } = await import("electrobun/view");
  const listeners = new Set<() => void>();
  const rpc = Electroview.defineRPC<StudioRPC>({
    maxRequestTime: Infinity,
    handlers: {
      requests: {
        notify: ({ id, requestId, title, body }) => {
          if (
            typeof Notification === "undefined" ||
            Notification.permission !== "granted"
          )
            return false;
          const notice = new Notification(title, { body, tag: requestId });
          notice.onclick = () => {
            window.focus();
            location.hash =
              "/run/" +
              encodeURIComponent(id) +
              "?request=" +
              encodeURIComponent(requestId);
            notice.close();
          };
          return true;
        },
      },
      messages: {
        changed: () => {
          for (const fn of listeners) fn();
        },
      },
    },
  });
  new Electroview({ rpc });
  const route = await rpc.request.initialRoute();
  if (route) location.hash = route;
  return {
    previewLoom: (source) => rpc.request.previewLoom({ source }),
    configuration: (projectDir) => rpc.request.configuration({ projectDir }),
    getRun: (id) => rpc.request.getRun({ id }),
    listRuns: (params) => rpc.request.listRuns(params),
    snapshot: () => rpc.request.snapshot(),
    update: (command) => rpc.request.update(command),
    act: (action) => rpc.request.act(action),
    pick: (kind) => rpc.request.pick({ kind }),
    artifact: (id, mode) => rpc.request.artifact({ id, mode }),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
