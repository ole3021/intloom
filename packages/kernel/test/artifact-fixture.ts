import type { StoredArtifact } from "@intloom/loom-sdk";

export const artifact: StoredArtifact = {
  id: "ART-todo",
  loomName: "fixture",
  stageName: "first",
  revision: 1,
  data: {
    title: "Todo requirements",
    requirements: ["Add tasks", "Browser persistence"],
    note: "  original\ncontent  ",
  },
  createdAt: "2026-10-08T00:00:00.000Z",
  updatedAt: "2026-10-08T00:00:00.000Z",
};
