import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Action, DesktopApi } from "../../shared/types";
type Snapshot = Awaited<ReturnType<DesktopApi["snapshot"]>>;

const origins = new Map<string, string>();
export function navigate(path: string) {
  const from = location.hash.slice(1) || "/";
  if (path.startsWith("/run/") && path !== from)
    origins.set(path, from.startsWith("/launch/") ? "/" : from);
  location.hash = path;
}
export function backFromRun() {
  location.hash = origins.get(location.hash.slice(1)) || "/";
}
function readRoute() {
  const u = new URL(location.hash.slice(1) || "/", "https://studio.local");
  return {
    path: u.pathname.split("/").filter(Boolean).map(decodeURIComponent),
    params: u.searchParams,
  };
}
export function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const fn = () => setRoute(readRoute());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return route;
}
interface Context {
  state: Snapshot;
  api: DesktopApi;
  refresh: () => Promise<Snapshot>;
  perform: (
    a: Action,
  ) => Promise<Awaited<ReturnType<DesktopApi["act"]>> | undefined>;
  show: (message: string) => void;
  error: string;
  notice: string;
  dismiss: () => void;
}
const Studio = createContext<Context | null>(null);
export function useStudio() {
  const s = useContext(Studio);
  if (!s) throw Error("Studio context missing");
  return s;
}
export function StudioProvider({
  api,
  children,
}: {
  api: DesktopApi;
  children: ReactNode;
}) {
  const [state, setState] = useState<Snapshot>(),
    [error, show] = useState(""),
    [notice, setNotice] = useState("");
  const seen = useRef<Set<string> | null>(null);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    const data = await api.snapshot();
    if (seq === sequence.current) {
      const requests = data.runs.flatMap((r) =>
        r.pending.map((q) => ({ id: q.id, run: r.summary.id })),
      );
      if (seen.current) {
        const newest = requests.find((q) => !seen.current?.has(q.id));
        if (newest) setNotice(newest.id);
      }
      seen.current = new Set(requests.map((q) => q.id));
      setState(data);
    }
    return data;
  }, [api]);
  useEffect(() => {
    let live = true;
    const load = () => {
      void refresh().catch((e) => {
        if (live) show(String(e));
      });
    };
    const unsub = api.subscribe(load);
    window.addEventListener("focus", load);
    window.addEventListener("hashchange", load);
    void load();
    return () => {
      live = false;
      sequence.current++;
      unsub();
      window.removeEventListener("focus", load);
      window.removeEventListener("hashchange", load);
    };
  }, [api, refresh]);
  const perform = useCallback(
    async (a: Action) => {
      try {
        show("");
        return await api.act(a);
      } catch (e) {
        show(e instanceof Error ? e.message : String(e));
      }
    },
    [api],
  );
  const theme = state?.settings.theme,
    reduced = state?.settings.reduceMotion;
  useEffect(() => {
    if (!theme) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
      document.documentElement.dataset.motion = reduced ? "off" : "on";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, reduced]);
  if (!state)
    return (
      <main className="p-8">
        {error || "正在连接本机工作台…"}
        {error && (
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => window.location.reload()}
          >
            重新连接
          </button>
        )}
      </main>
    );
  return (
    <Studio.Provider
      value={{
        state,
        api,
        refresh,
        perform,
        show,
        error,
        notice,
        dismiss: () => setNotice(""),
      }}
    >
      {children}
    </Studio.Provider>
  );
}
