import { implementationContextSchema } from "../schema/context.ts";
import * as z from "zod";
import { defineAgentTool } from "@intloom/loom-sdk";
import { resultSchema, text, refs } from "../../../src/schema/common.ts";
import { observationSubmissionSchema } from "../../../src/schema/verification.ts";
import {
  implementationSubmissionSchema,
  diagnosticInputSchema,
} from "../schema/submission.ts";
import {
  readContext,
  submit,
  diagnose,
  observe,
  retryVerification,
} from "../src/actions.ts";
export const readImplementationContext = defineAgentTool({
  id: "read_implementation_context",
  description:
    "Read the fixed requirements and plan, actual net changes, candidate and current revision. Refresh after file edits before submitting; do not manufacture change IDs.",
  inputSchema: z.strictObject({}),
  outputSchema: implementationContextSchema,
  execute: readContext,
});
export const submitImplementation = defineAgentTool({
  id: "submit_implementation",
  description:
    "Account for every planned implementation item and actual change. Reuse needs current source evidence; incomplete work needs a concrete remaining scope. Mark needs_attention to request real user resolution. On saved=true finish with the returned outcome.",
  inputSchema: implementationSubmissionSchema,
  outputSchema: resultSchema,
  endsAgent: (r) => r.saved,
  execute: submit,
});
export const runDiagnostic = defineAgentTool({
  id: "run_implementation_diagnostic",
  description:
    "Request a bounded host diagnostic using command and args separately. Its actual receipt is retained but does not replace the approved formal verification plan. Refresh context after execution.",
  inputSchema: diagnosticInputSchema,
  outputSchema: z.json(),
  execute: diagnose,
});
export const submitObservation = defineAgentTool({
  id: "submit_implementation_observation",
  description:
    "Account for every assigned procedure step using actual evidence references. Describe unperformed steps as not_observed. Code reading is not browser operation. On saved=true finish with the returned outcome.",
  inputSchema: observationSubmissionSchema,
  outputSchema: resultSchema,
  endsAgent: (r) => r.saved,
  execute: observe,
});

export const retryImplementationVerification = defineAgentTool({
  id: "retry_implementation_verification",
  description:
    "Queue a settled unsuccessful verification again only after a new diagnostic receipt or actual user information explains changed conditions. Original evidence is retained. This never retries an unsettled command. Submit implementation after preparing the retry.",
  inputSchema: z.strictObject({
    revision: z.number().int().nonnegative(),
    verificationRef: text,
    reason: text,
    evidenceRefs: refs.min(1),
  }),
  outputSchema: resultSchema,
  execute: retryVerification,
});
