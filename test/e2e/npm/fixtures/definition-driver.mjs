import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createToolScope } from "@intloom/kernel";

function frozen(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}

// Test-only evaluation of definitions. No lifecycle, scheduling or persistence.
export async function testContext(
  t,
  { agent, answers = [], choices = [], onInteraction } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-business-"));
  const workDir = join(directory, "work");
  const tempDir = join(directory, "temp");
  await Promise.all([mkdir(workDir), mkdir(tempDir)]);
  const calls = [];
  const questions = [];
  let answerIndex = 0;
  let choiceIndex = 0;
  const tools = createToolScope({
    tempDir,
    onInteraction(interaction) {
      questions.push(interaction);
      if (onInteraction) {
        onInteraction(interaction, tools);
        return;
      }
      const { question } = interaction;
      let value;
      if (question.mode === "single") {
        assert.ok(
          choiceIndex < choices.length,
          "Unexpected single-choice question",
        );
        value = { kind: "option", value: choices[choiceIndex++] };
      } else {
        assert.ok(answerIndex < answers.length, "Unexpected answer or retry");
        value = answers[answerIndex++];
      }
      tools.interactions.submit(interaction.id, { status: "answered", value });
    },
  });
  t.after(async () => {
    assert.deepEqual(await tools.close(), []);
    await rm(directory, { recursive: true, force: true });
  });
  const executions = [];
  const context = {
    ...tools,
    mode: "run",
    runId: "test-run",
    scope: "intloom",
    workDir,
    tempDir,
    async exec(target, input) {
      context.signal.throwIfAborted();
      const data = input === undefined ? undefined : structuredClone(input);
      executions.push({ target, input: data });
      let output;
      if (typeof target === "function") output = await target(data, context);
      else if (target.kind === "agent") {
        assert.equal(typeof agent, "function", "Unexpected Agent execution");
        calls.push({ target, input: data });
        output = await agent(target, data);
        if (target.returns) output = target.returns.parse(output);
      } else {
        assert.equal(target.kind, "workflow");
        const steps = {};
        for (const node of target.steps) {
          assert.equal(
            node.when,
            undefined,
            "This fixture driver only supports sequential and repeat nodes",
          );
          assert.equal(
            node.next,
            undefined,
            "This fixture driver only supports sequential and repeat nodes",
          );
          let next = node.input(frozen({ input: data, steps: { ...steps } }));
          let result;
          for (let iteration = 1; ; iteration++) {
            result = await context.exec(node.exec, next);
            if (
              node.kind !== "repeat" ||
              node.until(frozen({ result, iteration }))
            )
              break;
            if (iteration === node.max)
              throw new Error(`REPEAT_LIMIT: ${node.name}`);
            next = node.nextInput(frozen({ result, iteration }));
          }
          steps[node.name] = result;
        }
        output = target.mapResult?.(frozen({ input: data, steps }));
      }
      return output === undefined
        ? undefined
        : JSON.parse(JSON.stringify(output));
    },
  };
  return { context, calls, questions, directory, executions };
}
