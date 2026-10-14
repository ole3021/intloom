import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";
import { projectPathSchema } from "../schemas/engineering.ts";
import {
  validationProposalSchema,
  validationContextSchema,
  validationSubmissionResultSchema,
} from "../schemas/validation-state.ts";
import {
  readValidation,
  reviewValidation,
  ValidationReportRejected,
  targets,
} from "../src/validation/review.ts";
import { authoring } from "../src/flow/draft.ts";
import { fail, json, project, objects } from "../src/flow/shared.ts";
export const readValidationContext = defineAgentTool({
  id: "read_validation",
  description:
    "Read the required scope and its reasons, current target content, changed paths, host check summaries and submission feedback. Inspect actual code and test coverage; passed commands alone do not prove every requirement. Do not edit product files.",
  inputSchema: z.strictObject({}),
  outputSchema: validationContextSchema,
  execute: async (_input, access) => {
    const state = readValidation(access);
    const all = new Map([
      ...objects(state.specification?.data),
      ...objects(state.solution?.data),
    ]);
    return validationContextSchema.parse(
      json({
        id: state.id,
        intent: state.intent,
        implementationRecordId: state.implementationRecordId,
        scope: state.scope,
        scopeMode: state.scopeMode,
        targets: [
          ...(state.scope?.specification ?? []),
          ...(state.scope?.solution ?? []),
        ].map((t) => ({
          ...t,
          data: targetView(state.scopeContext[t.ref] ?? all.get(t.ref)),
          reasons: state.scopeReasons[t.ref] ?? [],
        })),
        changedPaths: state.changedPaths,
        commandResults: state.commandResults.map(
          ({ stdout: _out, stderr: _err, ...result }) => result,
        ),
        submissionCount: state.submissionCount,
        submissionFeedback: state.submissionFeedback,
      }),
    );
  },
});
export const readValidationFile = defineAgentTool({
  id: "read_validation_file",
  description:
    "Read one UTF-8 business file with exact one-based line numbers and lineCount for evidence citations. Cite existing lines only; omit optional source line lists when the precise span is unknown. No files are modified.",
  inputSchema: z.strictObject({ path: projectPathSchema }),
  outputSchema: z.strictObject({
    content: z.string(),
    lineCount: z.number().int().positive(),
  }),
  execute: async (input, access) => {
    const lines = (await project(access).read(input.path)).split("\n");
    return {
      content: lines.map((line, index) => `${index + 1}: ${line}`).join("\n"),
      lineCount: lines.length,
    };
  },
});
export const submitValidation = defineAgentTool({
  id: "submit_validation",
  description:
    "Submit one check for every scoped object, evidence linked to its target, real test statuses and findings. For code_path, normally provide {path} without optional lines; never copy estimated Implementation spans. Required test/finding ranges must come from read_validation_file. Use method code for source inspection without an executed command. Methods test/runtime_observation/static_analysis require an exact commandResults ID as checkId; do not invent or borrow unrelated command evidence. Use partial or undone when support is incomplete or missing. No aggregate counts or repair claims are accepted. If saved is false, correct the report and audit every location before the single permitted resubmission; omit all optional line lists whose exact positions were not read. Return ready only after saved is true; do not edit product files.",
  inputSchema: validationProposalSchema,
  outputSchema: validationSubmissionResultSchema,
  endsAgent: (output) => output.saved,
  execute: async (
    input,
    access,
  ): Promise<z.infer<typeof validationSubmissionResultSchema>> => {
    const state = readValidation(access);
    if (state.proposal || state.submissionCount >= 2)
      fail(
        "Validation allows one submission and at most one report correction.",
        "INTENT_BUDGET_EXCEEDED",
      );
    state.submissionCount += 1;
    try {
      await reviewValidation(access, { ...state, proposal: input });
    } catch (error) {
      if (!(error instanceof ValidationReportRejected)) throw error;
      state.submissionFeedback = error.feedback;
      await access.state.update(json(state));
      if (state.submissionCount === 2) throw error;
      return { saved: false, attemptsRemaining: 1, feedback: error.feedback };
    }
    state.proposal = input;
    delete state.submissionFeedback;
    await access.state.update(json(state));
    return { saved: true };
  },
});

export const readValidationDetails = defineAgentTool({
  id: "read_validation_details",
  description:
    "Read additional current objects or complete host command results by ID. Empty targetRefs and checkIds list the available target catalog for regression scope selection.",
  inputSchema: z.strictObject({
    targetRefs: z.array(z.string()),
    checkIds: z.array(z.string()),
  }),
  outputSchema: z.json(),
  execute: async (input, access) => {
    const state = readValidation(access);
    const index = new Map([
      ...objects(state.specification?.data),
      ...objects(state.solution?.data),
    ]);
    if (!input.targetRefs.length && !input.checkIds.length) {
      const selected = new Set(
        [
          ...(state.scope?.specification ?? []),
          ...(state.scope?.solution ?? []),
        ].map((t) => t.ref),
      );
      return json({
        catalog: [
          ...targets(state.specification?.data, true),
          ...targets(state.solution?.data, true),
        ].map((t) => ({
          ...t,
          selected: selected.has(t.ref),
          summary: String(
            index.get(t.ref)?.description ??
              index.get(t.ref)?.name ??
              index.get(t.ref)?.responsibility ??
              "",
          ).slice(0, 160),
        })),
      });
    }
    return json({
      objects: input.targetRefs.map((ref) => {
        const value = state.scopeContext[ref] ?? index.get(ref);
        if (!value) fail(`Unknown validation object: ${ref}`);
        return authoring(value);
      }),
      commandResults: input.checkIds.map((id) => {
        const result = state.commandResults.find((r) => r.id === id);
        if (!result) fail(`Unknown host check: ${id}`);
        return result;
      }),
    });
  },
});
export const expandValidationScope = defineAgentTool({
  id: "expand_validation_scope",
  description:
    "Add current objects to regression coverage with a concrete impact reason. Required scope cannot be removed. Expand before submitting the report.",
  inputSchema: z.strictObject({
    targetRefs: z.array(z.string()).min(1),
    reason: z.string().trim().min(1),
  }),
  outputSchema: z.json(),
  execute: async (input, access) => {
    const state = readValidation(access);
    if (state.submissionCount || state.proposal)
      fail("Scope is fixed after the first report submission.");
    const index = new Map([
      ...objects(state.specification?.data),
      ...objects(state.solution?.data),
    ]);
    for (const ref of input.targetRefs) {
      const item = index.get(ref);
      const target = targets(item, true).find((t) => t.ref === ref);
      if (!item || !target) fail(`Unknown validation target: ${ref}`);
      const group = ref.startsWith("S") ? "specification" : "solution";
      if (!state.scope?.[group].some((t) => t.ref === ref))
        state.scope?.[group].push(target);
      state.scopeContext[ref] = json(item);
      state.scopeReasons[ref] = [
        ...(state.scopeReasons[ref] ?? []),
        input.reason,
      ];
    }
    await access.state.update(json(state));
    return json(state.scope);
  },
});

/** Child targets have their own scoped content; parent summaries need only their identities. */
function targetView(value: unknown) {
  const result = authoring(value);
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const item = result as Record<string, unknown>;
    for (const key of ["acceptances", "modules"]) {
      if (Array.isArray(item[key]))
        item[key] = item[key].map((child) => ({ ref: child.id }));
    }
  }
  return result;
}
