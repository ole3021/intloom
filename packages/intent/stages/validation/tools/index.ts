import { validationContextSchema } from "../schema/context.ts";
import * as z from "zod";
import { defineAgentTool } from "@intloom/loom-sdk";
import { resultSchema, text } from "../../../src/schema/common.ts";
import { observationSubmissionSchema } from "../../../src/schema/verification.ts";
import { assessmentSubmissionSchema } from "../schema/submission.ts";
import { readContext, submit, observe, requestStop } from "../src/actions.ts";
export const readValidationContext = defineAgentTool({
  id: "read_validation_context",
  description:
    "Read the fixed candidate, full round targets, verification dispositions, evidence descriptors and historical index. Read original evidence before relying on it; historical passes do not verify this candidate.",
  inputSchema: z.strictObject({}),
  outputSchema: validationContextSchema,
  execute: readContext,
});
export const submitAssessment = defineAgentTool({
  id: "submit_assessment",
  description:
    "Submit ready with every target assessed, needs_evidence with bounded supplementary requests, or needs_input with unanswered questions. Use $temporary finding IDs, explicit historical update references, and only actual evidence. Never compute overall verdict or claim user approval. On saved=true finish with the returned outcome.",
  inputSchema: assessmentSubmissionSchema,
  outputSchema: resultSchema,
  endsAgent: (r) => r.saved,
  execute: submit,
});
export const submitObservation = defineAgentTool({
  id: "submit_validation_observation",
  description:
    "Record actual procedure observations and their sources. Unperformed actions remain not_observed. Source inspection does not prove UI execution. On saved=true finish with the returned outcome.",
  inputSchema: observationSubmissionSchema,
  outputSchema: resultSchema,
  endsAgent: (r) => r.saved,
  execute: observe,
});
export const requestCollectionStop = defineAgentTool({
  id: "request_collection_stop",
  description:
    "Ask Code to present unresolved collection work to the user for continue, pause or stop. This request does not itself authorize stopping. On saved=true finish with the returned outcome.",
  inputSchema: z.strictObject({ revision: z.number(), reason: text }),
  outputSchema: resultSchema,
  endsAgent: (r) => r.saved,
  execute: requestStop,
});
