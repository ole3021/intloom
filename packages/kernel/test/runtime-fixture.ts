import * as z from "zod";
import type { Blueprint, BlueprintStage } from "../src/workflow/blueprint.ts";
import type { Effector } from "../src/effector/contracts.ts";
import type { ExecutableCode } from "../src/effector/execution.ts";
import type { StorageAccess } from "../src/storage/contracts.ts";
import type { RuntimeOptions } from "../src/runtime/contracts.ts";

export const fixtureStateSchema = z.object({
  value: z.number().default(0),
  intent: z.string(),
});

export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export function runtimeFixture() {
  const events: string[] = [];
  const contexts: { runId: string; stageName: string; intent: string }[] = [];
  const first: BlueprintStage = {
    stageName: "first",
    stateSchema: fixtureStateSchema,
    initializeState(context) {
      contexts.push(context);
      events.push(`init:${context.stageName}`);
      return { intent: context.intent };
    },
    entryStepName: "start",
    steps: {
      review: {
        stepName: "review",
        execution: { kind: "code", codeId: "review" },
        on: { complete: { kind: "stage_end" } },
      },
      start: {
        stepName: "start",
        execution: { kind: "code", codeId: "start" },
        on: {
          complete: { kind: "step", stepName: "review" },
          retry: { kind: "step", stepName: "start" },
          reenter: { kind: "stage_end" },
        },
      },
    },
    on: {
      complete: { kind: "stage", stageName: "second" },
      reenter: { kind: "stage", stageName: "first" },
    },
  };
  const second: BlueprintStage = {
    ...first,
    stageName: "second",
    entryStepName: "finish",
    steps: {
      finish: {
        stepName: "finish",
        execution: { kind: "code", codeId: "finish" },
        on: { complete: { kind: "stage_end" } },
      },
    },
    on: { complete: { kind: "workflow_end" } },
  };
  const blueprint: Blueprint = {
    flowName: "fixture",
    entryStageName: "first",
    stages: { second, first },
  };
  const codes: Record<string, ExecutableCode> = {};
  for (const name of ["start", "review", "finish"]) {
    codes[name] = () => {
      events.push(`code:${name}`);
      return { outcome: "complete" };
    };
  }
  const storage: StorageAccess = {
    async getArtifact() {
      return undefined;
    },
    async getArtifactById() {
      return undefined;
    },
    async getLatestRecord() {
      return undefined;
    },
    async getRecordById() {
      return undefined;
    },
    async listArtifacts() {
      return { data: [] };
    },
    async listRecords() {
      return { data: [] };
    },
    async commit() {
      return {
        writtenArtifacts: [],
        appendedRecords: [],
        removedArtifactIds: [],
        removedRecordIds: [],
      };
    },
  };
  const effector: Effector = {
    async executeCode(code, input, access) {
      return code(input, access);
    },
    async executeAgent() {
      throw new Error("Unexpected Agent execution");
    },
  };
  const options: RuntimeOptions = { codes, agents: {}, effector, storage };
  return {
    blueprint,
    first,
    second,
    codes,
    options,
    storage,
    events,
    contexts,
  };
}
