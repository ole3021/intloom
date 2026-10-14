import * as z from "zod";

const agentId = "AGENT-abcdefghijklmnopqrstu";
const questionsId = "CODE-abcdefghijklmnopqrstu";
const confirmationId = "CODE-ABCDEFGHIJKLMNOPQRSTU";
const finalizeId = "CODE-123456789012345678901";
const stateSchema = z.object({
  id: z.string(),
  intent: z.string(),
  readCount: z.number().int().nonnegative(),
  task: z
    .object({ summary: z.string().min(1), question: z.string().min(1) })
    .optional(),
  answers: z.json().optional(),
  isConfirmed: z.boolean().optional(),
});

export const blueprint = {
  flowName: "codex-compatibility",
  entryStageName: "compatibility",
  stages: {
    compatibility: {
      stageName: "compatibility",
      stateSchema,
      initializeState: ({ runId, intent }) => ({
        id: runId,
        intent,
        readCount: 0,
      }),
      entryStepName: "agent",
      steps: {
        agent: {
          stepName: "agent",
          execution: { kind: "agent", agentId },
          on: { complete: { kind: "step", stepName: "questions" } },
        },
        questions: {
          stepName: "questions",
          execution: { kind: "code", codeId: questionsId },
          on: { complete: { kind: "step", stepName: "confirmation" } },
        },
        confirmation: {
          stepName: "confirmation",
          execution: { kind: "code", codeId: confirmationId },
          on: { complete: { kind: "step", stepName: "finalize" } },
        },
        finalize: {
          stepName: "finalize",
          execution: { kind: "code", codeId: finalizeId },
          on: { complete: { kind: "stage_end" } },
        },
      },
      on: { complete: { kind: "workflow_end" } },
    },
  },
};

export const agentSpecs = {
  [agentId]: {
    name: "compatibility-probe",
    description: "Exercise one actual client Agent task and its host Tools.",
    instructions:
      "Read the current intent through read_probe. Summarize its requested scope and ask the human to clarify the authorized scope or constraints, without inventing new requirements. Save your summary and question with submit_probe. You must use both host Tools. Finish with the raw outcome object required by the schema. You cannot answer questions or confirm on the human's behalf. All prose must be English.",
    llm: "reasoning",
    outputSchema: z.strictObject({ outcome: z.literal("complete") }),
    skills: [],
    tools: [
      {
        id: "read_probe",
        description: "Read the original intent from this task's current State.",
        inputSchema: z.strictObject({}),
        outputSchema: z.strictObject({ intent: z.string() }),
        async execute(_input, access) {
          const state = stateSchema.parse(access.state.value);
          await access.state.update({
            ...state,
            readCount: state.readCount + 1,
          });
          return { intent: state.intent };
        },
      },
      {
        id: "submit_probe",
        description:
          "Save an English scope summary and a question for the actual human action.",
        inputSchema: z.strictObject({
          summary: z.string().min(1),
          question: z.string().min(1),
        }),
        outputSchema: z.strictObject({ saved: z.literal(true) }),
        async execute(task, access) {
          const state = stateSchema.parse(access.state.value);
          if (!state.readCount || state.task)
            throw new Error("Read before submitting the one probe task.");
          await access.state.update({ ...state, task });
          return { saved: true };
        },
      },
    ],
  },
};

export const codes = {
  [questionsId]: async (_input, access) => {
    const state = stateSchema.parse(access.state.value);
    if (!state.task) throw new Error("The client Agent did not save its task.");
    const answers = await access.interaction.askQuestions([
      { id: "scope", question: state.task.question, isSkippable: false },
    ]);
    await access.state.update({ ...state, answers });
    return { outcome: "complete" };
  },
  [confirmationId]: async (_input, access) => {
    const state = stateSchema.parse(access.state.value);
    const decision = await access.interaction.confirm(
      `Confirm saving this compatibility result.\nOriginal intent: ${state.intent}\nAgent proposal: ${state.task?.summary}\nYour answer: ${JSON.stringify(state.answers)}`,
    );
    if (!decision.isConfirmed)
      throw new Error("The human declined the compatibility result.");
    await access.state.update({ ...state, isConfirmed: true });
    return { outcome: "complete" };
  },
  [finalizeId]: async (_input, access) => {
    const state = stateSchema.parse(access.state.value);
    if (!state.task || !state.answers || !state.isConfirmed)
      throw new Error("Required client interactions are incomplete.");
    const payload = {
      flowName: "codex-compatibility",
      stageName: "compatibility",
      data: state,
    };
    await access.storage.commit([
      { type: "create_artifact", id: `ART-${state.id}`, payload },
      { type: "append_record", id: `REC-${state.id}`, payload },
    ]);
    return { outcome: "complete" };
  },
};
