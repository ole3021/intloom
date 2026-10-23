import assert from "node:assert/strict";
import { test } from "node:test";
import { runtime } from "../test/runtime.ts";
import { requestClarification } from "./tools/questions.ts";
import { prepare, resolve } from "../stages/specification/src/steps.ts";
import { readState } from "../stages/specification/src/actions.ts";

test("an already answered clarification cannot close an Agent invocation without its submission", async () => {
  const f = runtime("specification");
  await prepare(f.access);
  const questions = [
    { key: "platform", question: "Which platform is required?" },
  ];
  const requested = await requestClarification.execute(
    { revision: readState(f.access).revision, questions },
    f.access,
  );
  assert.equal(requested.saved, true);
  f.replies.push([{ questionId: "platform", isSkipped: false, answer: "Web" }]);
  await resolve(f.access);
  const before = f.value();
  const repeated = await requestClarification.execute(
    { revision: readState(f.access).revision, questions },
    f.access,
  );
  assert.equal(repeated.saved, false);
  assert.equal(requestClarification.endsAgent?.(repeated), false);
  assert.deepEqual(f.value(), before);
});
