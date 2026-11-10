import {
  AcceptanceRefSchema,
  ArtifactRefSchema,
  defineCode,
  defineLoom,
  defineStep,
  defineWorkflow,
} from "@intloom/loom-sdk";
import { z } from "zod";

const inputSchema = z.object({ title: z.string(), body: z.string() });
const deliverableSchema = z.object({ report: ArtifactRefSchema });
const outputSchema = z.object({
  deliverable: deliverableSchema,
  acceptance: AcceptanceRefSchema,
});
const draft = defineCode({
  id: "write-report",
  inputSchema,
  outputSchema: deliverableSchema,
  async execute({ inputData, context }) {
    const report = await context.artifacts.write({
      name: "report.md",
      mediaType: "text/markdown",
      data: `# ${inputData.title}\n\n${inputData.body}\n`,
    });
    return { report };
  },
});
const review = defineStep({
  id: "review",
  inputSchema: deliverableSchema,
  outputSchema,
  suspendSchema: deliverableSchema,
  resumeSchema: z.object({ approved: z.boolean() }),
  interaction: {
    message: () => "Read the saved report, then approve or reject it.",
    context: ({ suspendData }) => suspendData,
    responsePolicy: "any",
  },
  async execute({ inputData, suspend, suspendData, resumeData, context }) {
    if (resumeData === undefined) return suspend(inputData);
    const deliverable = suspendData ?? inputData;
    const acceptance = await context.acceptance.record({
      subject: deliverable,
      result: {
        checks: [
          {
            criterionId: "reviewed",
            status: resumeData.approved ? "passed" : "rejected",
            evidence: [deliverable.report],
          },
        ],
      },
    });
    return { deliverable, acceptance };
  },
});

export default defineLoom({
  id: "reviewed-report",
  version: "1.0.0",
  description: "Write a Markdown report and wait for an explicit review.",
  outcome: {
    description: "A saved report with an explicit review decision.",
    artifacts: {
      report: { at: "/deliverable/report", mediaTypes: ["text/markdown"] },
    },
    acceptance: {
      at: "/acceptance",
      subjectAt: "/deliverable",
      criteria: [
        { id: "reviewed", description: "Reviewer approves the report." },
      ],
    },
  },
  entry: defineWorkflow({ id: "report-flow", inputSchema, outputSchema })
    .then(defineStep(draft, { id: "draft" }))
    .then(review)
    .commit(),
});
