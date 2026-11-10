import { mockInstallPreview } from "../mock/install.ts";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createSeed, MockService, recoverOnOpen } from "../mock/service";
import { overview, listRuns, getRun } from "../mock/queries";
import { loadState } from "../mock/persistence";
import type { Action, RunQuery } from "../shared/types";
import { copyArtifact, createCandidateWriter } from "./artifacts";

export function mockBackend(directory: string, changed: () => void) {
  const file = join(directory, "mock-v1.json");
  const saved = existsSync(file);
  const state = saved ? loadState(readFileSync(file, "utf8")) : createSeed();
  if (saved) recoverOnOpen(state);
  const service = new MockService(state);
  function persist() {
    writeFileSync(file + ".tmp", JSON.stringify(state), { mode: 0o600 });
    renameSync(file + ".tmp", file);
  }
  const prepare = createCandidateWriter(directory, () => {
    persist();
    changed();
  });
  persist();
  void prepare(state.runs);
  return {
    previewLoom: async (source: string) =>
      mockInstallPreview(source, state.installed),
    snapshot: () => overview(state),
    listRuns: (query: RunQuery) => listRuns(state, query),
    getRun: (id: string) => getRun(state, id),
    act: (action: Action) => {
      const result = service.apply(
        action,
        process.env.INTLOOM_STUDIO_TEST_ACTOR === "1" ? "test" : "human",
      );
      persist();
      return result;
    },
    artifact: (id: string, folder?: string) => {
      const run = state.runs.find((r) => r.artifact?.id === id);
      if (!run?.artifact) throw Error("固定版本暂不可用。");
      return copyArtifact(directory, run.artifact, folder);
    },
    tick: () => {
      if (service.tick()) {
        void prepare(state.runs);
        persist();
        changed();
      }
    },
  };
}
