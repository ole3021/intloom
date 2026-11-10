import { useCallback, useEffect, useState } from "react";
import type { RunQuery } from "../../shared/types";
import { useStudio } from "../lib/studio";

function useQuery<T>(read: () => Promise<T>, enabled: boolean) {
  const { api, show } = useStudio();
  const [result, setResult] = useState<{ read: () => Promise<T>; value: T }>();
  useEffect(() => {
    if (!enabled) return;
    let sequence = 0;
    function refresh() {
      const current = ++sequence;
      void read().then(
        (value) => {
          if (current === sequence) setResult({ read, value });
        },
        (error) => {
          if (current === sequence) show(String(error));
        },
      );
    }
    const unsubscribe = api.subscribe(refresh);
    refresh();
    return () => {
      sequence++;
      unsubscribe();
    };
  }, [api, read, enabled, show]);
  return enabled && result?.read === read ? result.value : undefined;
}
export function useRun(id: string | null) {
  const { api, state } = useStudio();
  const read = useCallback(() => api.getRun(id ?? ""), [api, id]);
  return useQuery(read, !!id && (!!state.mock || state.service !== "offline"));
}
export function useRunList(query: RunQuery | null) {
  const { api } = useStudio();
  const { query: term, status, loom, limit, cursor } = query ?? {};
  const read = useCallback(
    () => api.listRuns({ query: term, status, loom, limit, cursor }),
    [api, term, status, loom, limit, cursor],
  );
  return useQuery(read, !!query);
}
