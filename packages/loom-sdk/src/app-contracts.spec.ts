import assert from "node:assert/strict";
import { test } from "node:test";
import {
  interactionChoices,
  choiceAnswer,
  readPointer,
} from "./app-contracts.ts";
import {
  loomDefinitionSchema,
  interactionDefinitionSchema,
} from "./capability.ts";
test("optional App declarations normalize HTML defaults without changing the minimal contract", () => {
  const minimal = {
    name: "sample",
    version: "1.0.0",
    input: true,
    output: true,
    execute: { code: "./run.ts#run" },
  };
  assert.equal(loomDefinitionSchema.parse(minimal).apps, undefined);
  assert.deepEqual(
    loomDefinitionSchema.parse({
      ...minimal,
      apps: { booking: { path: "./app" } },
    }).apps?.booking,
    { path: "./app", entry: "index.html", type: "html" },
  );
  assert.throws(() =>
    interactionDefinitionSchema.parse({
      kind: "confirm",
      title: "Confirm",
      context: true,
      presentation: { choices: {} },
    }),
  );
});
test("choice projection preserves scalar types and rejects ambiguous data", () => {
  const mapping = {
    itemsPath: "/rooms",
    valuePath: "/id",
    labelPath: "/name",
    responsePath: "/selection/id",
  };
  const choices = interactionChoices(
    {
      rooms: [
        { id: false, name: "No" },
        { id: 42, name: "Forty two" },
      ],
    },
    mapping,
  );
  const selected = choices[1];
  assert.ok(selected);
  assert.deepEqual(choiceAnswer(mapping.responsePath, selected.value), {
    selection: { id: 42 },
  });
  assert.throws(() =>
    interactionChoices(
      {
        rooms: [
          { id: 1, name: "a" },
          { id: 1, name: "b" },
        ],
      },
      mapping,
    ),
  );
  assert.throws(() => interactionChoices({}, mapping));
});
test("JSON pointers never access inherited state or mutate prototypes", () => {
  assert.equal(readPointer({ "a/b": { "~": "yes" } }, "/a~1b/~0"), "yes");
  assert.equal(readPointer({}, "/constructor/prototype"), undefined);
  assert.throws(() => choiceAnswer("/__proto__/polluted", true));
  assert.equal(Object.hasOwn({}, "polluted"), false);
});
