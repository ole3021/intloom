import {
  type CodeContext,
  type JsonValue,
  type LoomInput,
  workflow,
} from "@intloom/loom-sdk";
import { z } from "zod";
import { analyze, audit, design, implement } from "./agents.ts";
import {
  applyEdits,
  assess,
  capture,
  checksFor,
  digest,
  verify,
} from "./project.ts";
import {
  type Baseline,
  type Candidate,
  configuration,
  type Plan,
  type ReviewDraft,
  type ReviewState,
  type Specification,
} from "./schemas.ts";

async function save(context: CodeContext, path: string, data: JsonValue) {
  if (context.mode === "chat")
    throw new Error("Intent requires a Run or PATCH.");
  const fullPath = `${context.workDir}/${path}`;
  await context.fs.write({
    path: fullPath,
    content: `${JSON.stringify(data, null, 2)}\n`,
  });
  return fullPath;
}

// Snapshots contain this Loom's already-validated internal data.
async function snapshot<T>(path: string, context: CodeContext): Promise<T> {
  return JSON.parse(await context.fs.read({ path })) as T;
}

type DraftSnapshot = {
  document: Specification | Plan;
  previousDraftPath: string | null;
  feedback: string;
};

async function collect(
  input: LoomInput,
  context: CodeContext,
): Promise<ReviewState> {
  const configPath = input.files?.[0];
  const projectDir = input.folders?.[0];
  if (
    !input.prompt?.trim() ||
    !configPath ||
    !projectDir ||
    input.files?.length !== 1 ||
    input.folders?.length !== 1
  ) {
    context.reject({
      reason:
        "Provide a prompt, one configuration file and one project folder.",
    });
  }
  const config = configuration.parse(
    JSON.parse(await context.fs.read({ path: configPath })),
  );
  const base = await capture(projectDir, input.prompt, config, context.fs);
  return {
    baselinePath: await save(context, "baseline.json", base),
    specificationPath: null,
    solutionPath: null,
    previousDraftPath: null,
    feedback: "",
    approved: false,
    revision: 1,
  };
}

async function draft(
  state: ReviewState,
  stage: ReviewDraft["stage"],
  context: CodeContext,
): Promise<ReviewDraft> {
  if (context.mode === "chat")
    throw new Error("Intent requires a Run or PATCH.");
  const base = await snapshot<Baseline>(state.baselinePath, context);
  const previous = state.previousDraftPath
    ? (await snapshot<DraftSnapshot>(state.previousDraftPath, context)).document
    : null;
  const checks = checksFor(base).map(({ id, description }) => ({
    id,
    description,
  }));
  let document: Specification | Plan;
  if (stage === "specification") {
    document = await context.exec(
      analyze,
      JSON.stringify({
        request: base.prompt,
        files: base.files,
        checks,
        previous,
        reviewerFeedback: state.feedback,
      }),
    );
    if (
      document.criteria.some((criterion) =>
        criterion.checks.some((id) => !checks.some((check) => check.id === id)),
      )
    ) {
      throw new Error("INTENT_UNKNOWN_CHECK");
    }
  } else {
    if (!state.specificationPath) throw new Error("INTENT_MISSING_SPEC");
    const spec = await snapshot<Specification>(
      state.specificationPath,
      context,
    );
    const strategy = await context.exec(
      design,
      JSON.stringify({
        request: base.prompt,
        files: base.files,
        specification: spec,
        previous,
        reviewerFeedback: state.feedback,
      }),
    );
    document = {
      ...strategy,
      files: base.files
        .filter((file) => file.editable)
        .map((file) => file.path),
      criteria: spec.criteria,
    };
  }
  await context.fs.mkdir({ path: `${context.workDir}/revisions` });
  const draftPath = await save(
    context,
    `revisions/${stage}-${state.revision}.json`,
    {
      document,
      previousDraftPath: state.previousDraftPath,
      feedback: state.feedback,
    },
  );
  return { state, stage, draftPath };
}

async function reviewDraft(
  { state, stage, draftPath }: ReviewDraft,
  context: CodeContext,
): Promise<ReviewState> {
  const { document } = await snapshot<DraftSnapshot>(draftPath, context);
  const base = await snapshot<Baseline>(state.baselinePath, context);
  const checks = checksFor(base);
  const criteria = document.criteria.map(
    (criterion, index) =>
      `${index + 1}. ${criterion.statement} [${
        checks
          .filter((check) => criterion.checks.includes(check.id))
          .map((check) => check.description)
          .join(", ") || "additional evidence required"
      }]`,
  );
  const preview =
    "goal" in document
      ? [document.goal, ...criteria]
      : [
          document.approach,
          ...document.steps,
          `Editable files: ${document.files.join(", ")}`,
          ...criteria,
        ];
  const answer = await context.user.ask({
    question: `How should this ${stage} draft proceed?`,
    context: `Revision ${state.revision}\n${preview.join("\n")}`,
    mode: "single",
    options: [
      { value: "approve", label: "Approve" },
      { value: "revise", label: "Revise" },
      { value: "reject", label: "End this task" },
    ],
    allowDefer: true,
  });
  if (answer.value.kind !== "option")
    throw new Error("Expected a review option");
  const decision = answer.value.value;
  const approved = decision === "approve";
  const feedback =
    decision === "revise"
      ? (
          await context.user.ask({
            question: "What should change in the next revision?",
            mode: "text",
            schema: z
              .string()
              .trim()
              .min(1, "Please describe the required changes."),
            allowDefer: true,
          })
        ).value
      : "";
  await save(context, `revisions/${stage}-${state.revision}.review.json`, {
    decision,
    approved,
    feedback,
  });
  if (decision === "reject")
    context.reject({ reason: `User declined the ${stage} draft.` });
  const approvedPath = approved
    ? await save(context, `${stage}.json`, document)
    : null;
  return {
    ...state,
    specificationPath:
      stage === "specification" && approved
        ? approvedPath
        : state.specificationPath,
    solutionPath:
      stage === "solution" && approved ? approvedPath : state.solutionPath,
    previousDraftPath: approved ? null : draftPath,
    feedback,
    approved,
  };
}

export const specificationReview = workflow<ReviewState>()
  .step("draft", {
    exec: (state: ReviewState, context: CodeContext) =>
      draft(state, "specification", context),
    input: ({ input }) => input,
  })
  .step("review", { exec: reviewDraft, input: ({ steps }) => steps.draft })
  .returns(({ steps }) => steps.review)
  .build();

export const solutionReview = workflow<ReviewState>()
  .step("draft", {
    exec: (state: ReviewState, context: CodeContext) =>
      draft(state, "solution", context),
    input: ({ input }) => input,
  })
  .step("review", { exec: reviewDraft, input: ({ steps }) => steps.draft })
  .returns(({ steps }) => steps.review)
  .build();

async function implementCandidate(
  state: ReviewState,
  context: CodeContext,
): Promise<string> {
  if (context.mode === "chat")
    throw new Error("Intent requires a Run or PATCH.");
  if (!state.specificationPath || !state.solutionPath || !state.approved)
    throw new Error("INTENT_MISSING_HANDOFF");
  const base = await snapshot<Baseline>(state.baselinePath, context);
  const plan = await snapshot<Plan>(state.solutionPath, context);
  const proposal = await context.exec(
    implement,
    JSON.stringify({ request: base.prompt, solution: plan, files: base.files }),
  );
  const files = applyEdits(base.files, plan.files, proposal.edits);
  const candidate: Candidate = {
    baselinePath: state.baselinePath,
    specificationPath: state.specificationPath,
    solutionPath: state.solutionPath,
    files,
    digest: digest(files),
    summary: proposal.summary,
    changes: files
      .filter((file, index) => file.content !== base.files[index]?.content)
      .map((file) => file.path),
    checks: await verify(files, base, context),
  };
  return save(context, "implementation.json", candidate);
}

async function validate(
  candidatePath: string,
  context: CodeContext,
): Promise<void> {
  if (context.mode === "chat")
    throw new Error("Intent requires a Run or PATCH.");
  const candidate = await snapshot<Candidate>(candidatePath, context);
  const base = await snapshot<Baseline>(candidate.baselinePath, context);
  const spec = await snapshot<Specification>(
    candidate.specificationPath,
    context,
  );
  const checks = await verify(candidate.files, base, context);
  const definitions = checksFor(base);
  const assessments = [];
  for (const criterion of spec.criteria) {
    const receipts = checks.filter((receipt) =>
      criterion.checks.includes(receipt.id),
    );
    const view = await context.exec(
      audit,
      JSON.stringify({
        criterion,
        files: candidate.files,
        checks: definitions
          .filter((check) => criterion.checks.includes(check.id))
          .map(({ id, description }) => ({ id, description })),
        validationReceipts: receipts,
      }),
    );
    assessments.push(assess(criterion, receipts, view));
  }
  await save(context, "validation.json", {
    candidate: candidate.digest,
    checks,
    assessments,
  });
  const requirements = assessments.every((item) => item.verdict === "passed");
  const regression = [...candidate.checks, ...checks].every(
    (check) => check.status === "exited" && check.exitCode === 0,
  );
  const status = requirements && regression ? "passed" : "rejected";
  await save(context, "acceptance.json", {
    candidate: candidate.digest,
    status,
    requirements: {
      status: requirements ? "passed" : "rejected",
      evidence: ["specification.json", "validation.json"],
    },
    regression: {
      status: regression ? "passed" : "rejected",
      evidence: ["implementation.json", "validation.json"],
    },
  });
  await context.fs.write({
    path: `${context.workDir}/summary.md`,
    content: `# Intent: ${status}\n\nCandidate: \`${candidate.digest}\`\n\n${candidate.summary}\n\nRequirements: ${requirements ? "passed" : "rejected"}\n\nRegression: ${regression ? "passed" : "rejected"}\n\n${assessments.map((item) => `- ${item.verdict}: ${item.statement} — ${item.reason}`).join("\n")}\n`,
  });
  if (status === "rejected")
    context.reject({
      reason:
        "The candidate did not satisfy the requirements and regression evidence.",
    });
}

export default workflow<LoomInput>()
  .step("capture-baseline", { exec: collect, input: ({ input }) => input })
  .repeat("specification", {
    exec: specificationReview,
    input: ({ steps }) => steps["capture-baseline"],
    until: ({ result }) => result.approved,
    nextInput: ({ result, iteration }) => ({
      ...result,
      revision: iteration + 1,
    }),
    max: 5,
  })
  .repeat("solution", {
    exec: solutionReview,
    input: ({ steps }) => ({
      ...steps.specification,
      approved: false,
      revision: 1,
    }),
    until: ({ result }) => result.approved,
    nextInput: ({ result, iteration }) => ({
      ...result,
      revision: iteration + 1,
    }),
    max: 5,
  })
  .step("implement", {
    exec: implementCandidate,
    input: ({ steps }) => steps.solution,
  })
  .step("validate", { exec: validate, input: ({ steps }) => steps.implement })
  .build();
