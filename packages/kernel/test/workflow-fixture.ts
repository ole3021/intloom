import * as z from "zod";
import type { WorkflowPackage } from "../src/workflow/types.ts";

export const codeId = "CODE-abcdefghijklmnopqrstu";
export const agentId = "AGENT-abcdefghijklmnopqrstu";
export const source: WorkflowPackage = {
  packageName: "@intloom/fixture",
  packageVersion: "1.0.0",
  protocolVersion: "2026-10-08",
  packageRoot: "/fixture",
  entryUrl: "file:///fixture/workflow.generated.js",
  assetRoot: "/fixture",
};

export function workflowModule() {
  return {
    blueprint: {
      flowName: "fixture",
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
          on: { complete: { kind: "workflow_end" } },
        },
      },
    },
    codes: { [codeId]: () => ({ outcome: "complete" }) },
    agentSpecs: {},
  };
}
