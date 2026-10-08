import type { ExecutableCode } from "@intloom/workflow-sdk";
import {
  readSolution,
  saveSolution,
  assertSolutionBasis,
} from "../../src/solution/state.ts";
import { reviewSolution } from "../../src/solution/changes.ts";
import { digest, fail } from "../../src/flow/shared.ts";
const confirm = (async (_input, access) => {
  const state = readSolution(access);
  const { confirmation, ...snapshot } = state;
  if (
    !confirmation ||
    confirmation.confirmed ||
    confirmation.digest !== digest(snapshot)
  )
    fail("Check must prepare a fresh Solution confirmation.");
  await assertSolutionBasis(access, state);
  const { artifact } = reviewSolution(state);
  const message = `Solution ready to save\n\n${JSON.stringify(artifact, null, 2)}\n\nImplementation checks\n${state.checks.map((c) => `${c.id}: ${c.command} ${c.args.join(" ")} (${c.purpose})`).join("\n")}`;
  let answer = await access.interaction.confirm(message);
  while (answer.isConfirmed && answer.feedback?.trim())
    answer = await access.interaction.confirm(
      `${message}\n\nYour answer included revision feedback. Decline to revise, or confirm without revision feedback to save.`,
    );
  await assertSolutionBasis(access, state);
  const { confirmation: _ignored, ...fresh } = readSolution(access);
  if (digest(fresh) !== confirmation.digest)
    fail("Solution changed during confirmation.");
  if (answer.isConfirmed)
    state.confirmation = { ...confirmation, confirmed: true };
  else {
    let feedback = answer.feedback;
    if (!feedback?.trim()) {
      const replies = await access.interaction.askQuestions([
        {
          id: "solution_feedback",
          question: "Describe the design changes you need.",
          isSkippable: false,
        },
      ]);
      const reply = replies[0];
      if (!reply || reply.isSkipped) fail("Design feedback is required.");
      feedback = reply.answer;
    }
    state.feedbacks.push({ source: "user", content: feedback });
    delete state.confirmation;
  }
  await assertSolutionBasis(access, state);
  const { confirmation: _last, ...current } = readSolution(access);
  if (digest(current) !== confirmation.digest)
    fail("Solution changed during confirmation.");
  await saveSolution(access, state);
  return { outcome: answer.isConfirmed ? "confirmed" : "feedback" };
}) satisfies ExecutableCode;
export default confirm;
