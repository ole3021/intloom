import type { MirrorScope } from "@intloom/kernel";
import * as z from "zod";
import {
  serviceRunViewSchema,
  admissionSchema,
  operationQuerySchema,
} from "@intloom/kernel/operations";
import type {
  ProjectInput,
  RunInput,
  StartRunInput,
  AnswerInput,
  ObserveOptions,
} from "./contracts.ts";

import { request } from "../client/http.ts";
import { observe } from "../client/events.ts";
export function createRunsOperations() {
  return {
    run(input: StartRunInput) {
      return request(input, "/api/v1/cli/runs", admissionSchema, {
        operationId: input.operationId,
        loomName: input.loomName,
        input: input.input,
      });
    },
    answerAsk(input: AnswerInput) {
      return request(
        input,
        `/api/v1/cli/runs/${encodeURIComponent(input.runId)}/answers`,
        admissionSchema,
        {
          operationId: input.operationId,
          actionId: input.actionId,
          answer: input.answer,
        },
      );
    },
    resumeRun(
      input: RunInput & {
        operationId: string;
        expectedRevision: number;
        abandonMirror?: boolean;
        serviceInstanceId: string;
        scope?: MirrorScope;
      },
    ) {
      return request(
        input,
        `/api/v1/cli/runs/${encodeURIComponent(input.runId)}/resume`,
        admissionSchema,
        {
          operationId: input.operationId,
          expectedRevision: input.expectedRevision,
          ...(input.abandonMirror === undefined
            ? {}
            : { abandonMirror: input.abandonMirror }),
          serviceInstanceId: input.serviceInstanceId,
          ...(input.scope ? { scope: input.scope } : {}),
        },
      );
    },
    pauseRun(input: RunInput & { operationId: string }) {
      return request(
        input,
        `/api/v1/cli/runs/${encodeURIComponent(input.runId)}/pause`,
        admissionSchema,
        { operationId: input.operationId },
      );
    },
    cancelRun(input: RunInput & { operationId: string }) {
      return request(
        input,
        `/api/v1/cli/runs/${encodeURIComponent(input.runId)}/cancel`,
        admissionSchema,
        { operationId: input.operationId },
      );
    },
    getRun(input: RunInput) {
      return request(
        input,
        `/api/v1/cli/runs/${encodeURIComponent(input.runId)}`,
        serviceRunViewSchema,
      );
    },
    listRuns(input: ProjectInput & { readonly loomName?: string }) {
      return request(
        input,
        `/api/v1/cli/runs${input.loomName ? `?loomName=${encodeURIComponent(input.loomName)}` : ""}`,
        z.array(serviceRunViewSchema),
      );
    },
    findRun(
      input: ProjectInput & {
        readonly originatingInstanceId: string;
        readonly operationId: string;
      },
    ) {
      return request(
        input,
        `/api/v1/cli/run-origin?serviceInstanceId=${encodeURIComponent(input.originatingInstanceId)}&operationId=${encodeURIComponent(input.operationId)}`,
        serviceRunViewSchema.nullable(),
      );
    },
    getOperation(input: ProjectInput & { readonly operationId: string }) {
      return request(
        input,
        `/api/v1/cli/operations/${encodeURIComponent(input.operationId)}`,
        operationQuerySchema,
      );
    },
    watchRun(input: RunInput, options?: ObserveOptions) {
      return observe(
        input,
        `/api/v1/cli/runs/${encodeURIComponent(input.runId)}/events`,
        options,
      );
    },
    watchProject(input: ProjectInput, options?: ObserveOptions) {
      return observe(input, "/api/v1/cli/events", options);
    },
  };
}
