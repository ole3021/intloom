import type { ProcessReceipt, ReadonlyData } from "@intloom/loom-sdk";
import { z } from "zod";

const text = z.string().trim().min(1);
const scoped = z.strictObject({ path: text, editable: z.boolean() });
const command = z.strictObject({
  id: text,
  description: text,
  command: text,
  args: z.array(z.string()),
});

export const configuration = z.strictObject({
  files: z.array(scoped).min(1),
  checks: z.array(command).min(1),
});
export type Configuration = z.infer<typeof configuration>;
export type Files = ReadonlyData<
  (z.infer<typeof scoped> & { content: string | null })[]
>;
export type Baseline = ReadonlyData<{
  prompt: string;
  files: Files;
  checks: Configuration["checks"];
  protectedHashes: { path: string; sha256: string }[];
}>;

export const specification = z.strictObject({
  goal: text,
  criteria: z
    .array(z.strictObject({ statement: text, checks: z.array(text) }))
    .min(1),
});
export const strategy = z.strictObject({
  approach: text,
  steps: z.array(text).min(1),
});
export const patch = z.strictObject({
  summary: text,
  edits: z.array(
    z.strictObject({ path: text, content: z.string().nullable() }),
  ),
});
export const opinion = z.strictObject({
  verdict: z.enum(["passed", "failed", "unverified"]),
  reason: text,
});
export type Specification = ReadonlyData<z.infer<typeof specification>>;
export type Plan = ReadonlyData<
  z.infer<typeof strategy> & {
    files: string[];
    criteria: Specification["criteria"];
  }
>;
export type Receipt = ReadonlyData<
  ProcessReceipt & {
    id: string;
    attemptId: string;
    candidate: string;
  }
>;
export type ReviewState = ReadonlyData<{
  baselinePath: string;
  specificationPath: string | null;
  solutionPath: string | null;
  previousDraftPath: string | null;
  feedback: string;
  approved: boolean;
  revision: number;
}>;
export type ReviewDraft = ReadonlyData<{
  state: ReviewState;
  stage: "specification" | "solution";
  draftPath: string;
}>;
export type Candidate = ReadonlyData<{
  baselinePath: string;
  specificationPath: string;
  solutionPath: string;
  files: Files;
  digest: string;
  summary: string;
  changes: string[];
  checks: Receipt[];
}>;
