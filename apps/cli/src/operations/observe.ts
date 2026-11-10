import type { RunActivityView, RunEventPage, RunView } from "@intloom/loom-sdk";
import type { ServiceClient } from "../service/protocol.ts";

export interface ObservationResult {
  reason: "terminal" | "waiting" | "timeout" | "interrupted";
  run: RunView;
  activity: RunActivityView;
}

export async function observeRun(options: {
  client: ServiceClient;
  runId: string;
  until: "waiting" | "terminal";
  timeoutMs?: number | undefined;
  answered?: string | undefined;
  cursor: { after: number };
  signal: AbortSignal;
  activity: (
    activity: RunActivityView,
    waiting: boolean,
    terminal: boolean,
  ) => void;
  events: (events: RunEventPage, loomId: string) => void;
}): Promise<ObservationResult> {
  const { client, runId, cursor, signal } = options;
  const started = Date.now();
  const append = (page: RunEventPage, loomId: string) => {
    options.events(page, loomId);
    for (const event of page.items)
      cursor.after = Math.max(cursor.after, event.seq);
  };
  while (true) {
    let activity = await client("getRunActivity", [runId]);
    let events: RunEventPage;
    do {
      events = await client("listRunEvents", [
        { runId, after: cursor.after, limit: 100 },
      ]);
      append(events, activity.run.loom.id);
    } while (
      events.nextAfter !== undefined &&
      !signal.aborted &&
      (options.timeoutMs === undefined ||
        Date.now() - started < options.timeoutMs)
    );
    // A different client may have resumed the Run while we read its events.
    if (cursor.after > activity.throughSeq)
      activity = await client("getRunActivity", [runId]);
    const { run } = activity;
    const terminal = [
      "succeeded",
      "failed",
      "cancelled",
      "interrupted",
    ].includes(run.status);
    const waiting =
      run.status === "waiting" &&
      Boolean(
        !options.answered ||
          run.pendingInteractionIds.length ||
          run.recoveryIssue ||
          !run.waits.some((w) => w.requestId === options.answered),
      );
    const remaining =
      options.timeoutMs === undefined
        ? 10_000
        : options.timeoutMs - (Date.now() - started);
    if (
      (terminal || (waiting && options.until === "waiting")) &&
      cursor.after < activity.throughSeq &&
      !signal.aborted &&
      remaining > 0
    )
      continue;
    options.activity(activity, waiting, terminal);
    const reason = signal.aborted
      ? "interrupted"
      : terminal
        ? "terminal"
        : waiting && options.until === "waiting"
          ? "waiting"
          : remaining <= 0
            ? "timeout"
            : undefined;
    if (reason)
      return {
        reason,
        activity,
        run: run.status === "succeeded" ? await client("getRun", [runId]) : run,
      };
    try {
      append(
        await client(
          "listRunEvents",
          [
            {
              runId,
              after: cursor.after,
              limit: 100,
              waitMs: Math.min(10_000, remaining),
            },
          ],
          signal,
        ),
        run.loom.id,
      );
    } catch (error) {
      if (!signal.aborted) throw error;
    }
  }
}
