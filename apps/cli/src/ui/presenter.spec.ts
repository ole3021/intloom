import assert from "node:assert/strict";
import { test } from "node:test";
import { terminalPresenter } from "./presenter.ts";
import { action, confirmation, terminal } from "../../test/unit-fixture.ts";

test("confirmation body is shown before a short generic decision prompt", async () => {
  const context =
    "Specification ready to save\n\nConstraints\n1. Use only localStorage.";
  const io = terminal(["confirm"]);
  const choose = io.ui.choose;
  io.ui.choose = async (message, choices) => {
    assert.equal(io.stderr, `${context}\n`);
    return choose(message, choices);
  };
  assert.deepEqual(
    await terminalPresenter(io.ui).present({
      ...confirmation,
      request: { context },
    }),
    { kind: "answered", answer: { isConfirmed: true } },
  );
  assert.deepEqual(io.messages, ["Do you confirm the content above?"]);
  assert.equal(io.stdout, "");
});

test("terminal questions support exact option labels and optional skip", async () => {
  assert.deepEqual(
    await terminalPresenter(terminal(["option_0", "skip"]).ui).present(action),
    {
      kind: "answered",
      answer: [
        {
          questionId: "required",
          isSkipped: false,
          answer: "  local\ndeployment  ",
        },
        { questionId: "optional", isSkipped: true },
      ],
    },
  );
});
test("terminal custom answers and revision feedback preserve raw text", async () => {
  const answer = await terminalPresenter(
    terminal(["custom", "  raw\ntext ", "custom", "optional"]).ui,
  ).present(action);
  assert.equal(answer.kind, "answered");
  if (answer.kind === "answered")
    assert.deepEqual(answer.answer, [
      { questionId: "required", isSkipped: false, answer: "  raw\ntext " },
      { questionId: "optional", isSkipped: false, answer: "optional" },
    ]);
  assert.deepEqual(
    await terminalPresenter(terminal(["revise", "Feedback"]).ui).present(
      confirmation,
    ),
    { kind: "answered", answer: { isConfirmed: false, feedback: "Feedback" } },
  );
});
test("cancelling anywhere discards the incomplete answer batch", async () => {
  assert.deepEqual(
    await terminalPresenter(terminal(["option_0", undefined]).ui).present(
      action,
    ),
    { kind: "dismissed" },
  );
  assert.deepEqual(
    await terminalPresenter(terminal(["revise", undefined]).ui).present(
      confirmation,
    ),
    { kind: "dismissed" },
  );
});
test("JSON/noninteractive output never prompts and has one clean JSON line", async () => {
  const io = terminal([], true, true);
  assert.deepEqual(await terminalPresenter(io.ui).present(action), {
    kind: "unavailable",
  });
  assert.deepEqual(await terminalPresenter(io.ui).present(confirmation), {
    kind: "unavailable",
  });
  io.ui.result({ status: "waiting" }, "human output");
  assert.equal(io.stdout, '{"status":"waiting"}\n');
  assert.equal(io.stderr, "");
  assert.deepEqual(io.messages, []);
});
