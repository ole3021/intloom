import * as z from "zod";
import type { LoomPackage } from "../src/loom/types.ts";

export const codeId = "CODE-abcdefghijklmnopqrstu";
export const agentId = "AGENT-abcdefghijklmnopqrstu";
export const source: LoomPackage = {
  packageName: "@intloom/fixture",
  packageVersion: "1.0.0",
  protocolVersion: "2026-10-15",
  packageRoot: "/fixture",
  entryUrl: "file:///fixture/loom.generated.js",
  assetRoot: "/fixture",
};

export function loomModule() {
  return {
    blueprint: {
      loomName: "fixture",
      inputs: ["prompt"],
      entryStageName: "first",
      stages: {
        first: {
          stageName: "first",
          initializeState: () => ({ value: "initial" }),
          stateSchema: z.strictObject({ value: z.string() }),
          entryStepName: "run",
          steps: {
            run: {
              stepName: "run",
              execution: { kind: "code", codeId },
              on: { complete: { kind: "stage_end" } },
            },
          },
          on: { complete: { kind: "loom_end" } },
        },
      },
    },
    codes: { [codeId]: () => ({ outcome: "complete" }) },
    agentSpecs: {},
  };
}
