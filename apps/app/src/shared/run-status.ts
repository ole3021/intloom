import type { RunSummary } from "@intloom/loom-sdk";
export const isActive = (run: { summary: RunSummary }) =>
  ["created", "running", "waiting", "stopping"].includes(run.summary.status);
