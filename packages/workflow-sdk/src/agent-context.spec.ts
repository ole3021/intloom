import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agentExecutionContextKey,
  getAgentExecutionAccess,
} from "./agent-context.ts";
import type { AgentExecutionAccess } from "./execution.ts";
import type { JsonValue } from "./json.ts";
import type { ProjectAccess } from "./project-access.ts";

function executionBinding(): AgentExecutionAccess<JsonValue> {
  const unused = () => {
    throw new Error("Validation must not call capabilities.");
  };
  return {
    state: {
      get value(): never {
        throw new Error("Validation must not read business State.");
      },
      create: unused,
      update: unused,
      clear: unused,
    },
    storage: {
      getArtifact: unused,
      getArtifactById: unused,
      getLatestRecord: unused,
      getRecordById: unused,
      listArtifacts: unused,
      listRecords: unused,
    },
    signal: new AbortController().signal,
  };
}

function rejectBinding(value: unknown) {
  assert.throws(() => getAgentExecutionAccess({ get: () => value }), {
    code: "STEP_EXECUTION_FAILED",
    retryable: false,
  });
}

test("reads only the invocation binding without reading State or calling capabilities", () => {
  const binding = executionBinding();
  const context = {
    get(key: string) {
      assert.equal(key, agentExecutionContextKey);
      return binding;
    },
  };
  assert.equal(getAgentExecutionAccess(context), binding);
  assert.throws(() => getAgentExecutionAccess({ get: () => undefined }), {
    message: `Effector must bind Agent execution capabilities at ${agentExecutionContextKey}.`,
  });
  assert.throws(
    () =>
      getAgentExecutionAccess({
        get: (key) =>
          key === "intloom.intent.specification" ? binding : undefined,
      }),
    { code: "STEP_EXECUTION_FAILED" },
  );
});

test("rejects missing or overprivileged bindings and invalid cancellation signals", () => {
  const binding = executionBinding();
  for (const value of [
    undefined,
    null,
    [],
    {},
    { ...binding, interaction: {} },
    { ...binding, storage: { ...binding.storage, commit: async () => {} } },
    {
      ...binding,
      storage: Object.create({ ...binding.storage, commit: undefined }),
    },
    Object.create({ ...binding, interaction: undefined }),
    { ...binding, signal: {} },
    { ...binding, signal: undefined },
  ])
    rejectBinding(value);
});

test("requires every State and read-only Storage method", () => {
  const binding = executionBinding();
  for (const [name, methods] of [
    ["state", ["create", "update", "clear"]],
    [
      "storage",
      [
        "getArtifact",
        "getArtifactById",
        "getLatestRecord",
        "getRecordById",
        "listArtifacts",
        "listRecords",
      ],
    ],
  ] as const) {
    for (const method of methods) {
      const members = Object.fromEntries(
        Object.entries(Object.getOwnPropertyDescriptors(binding[name])).filter(
          ([key]) => key !== method,
        ),
      );
      rejectBinding({
        ...binding,
        [name]: Object.defineProperties({}, members),
      });
      rejectBinding({
        ...binding,
        [name]: Object.defineProperties(
          {},
          {
            ...members,
            [method]: { value: "not callable", enumerable: true },
          },
        ),
      });
    }
    for (const value of [null, undefined, []])
      rejectBinding({ ...binding, [name]: value });
  }
  const { value: _value, ...methods } = Object.getOwnPropertyDescriptors(
    binding.state,
  );
  rejectBinding({ ...binding, state: Object.defineProperties({}, methods) });
});

test("validates optional Project access while accepting inherited capability methods", () => {
  const binding = executionBinding();
  const unused = () => {
    throw new Error("Validation must not call Project capabilities.");
  };
  const project = {
    snapshot: unused,
    read: unused,
    write: unused,
    remove: unused,
    run: unused,
  } satisfies ProjectAccess;
  const withProject = { ...binding, project: Object.create(project) };
  assert.equal(
    getAgentExecutionAccess({ get: () => withProject }),
    withProject,
  );
  const inherited = {
    ...binding,
    state: Object.create(binding.state),
    storage: Object.create(binding.storage),
  };
  assert.equal(getAgentExecutionAccess({ get: () => inherited }), inherited);
  for (const method of Object.keys(project)) {
    const members = Object.fromEntries(
      Object.entries(project).filter(([key]) => key !== method),
    );
    rejectBinding({ ...binding, project: members });
    rejectBinding({ ...binding, project: { ...members, [method]: null } });
  }
  for (const value of [null, undefined, [], {}])
    rejectBinding({ ...binding, project: value });
});

test("normalizes binding lookup and capability inspection failures", () => {
  const cause = new Error("Broken binding.");
  assert.throws(
    () =>
      getAgentExecutionAccess({
        get: () => {
          throw cause;
        },
      }),
    { code: "STEP_EXECUTION_FAILED", cause },
  );
  assert.throws(
    () =>
      getAgentExecutionAccess({
        get: () => ({
          ...executionBinding(),
          get storage() {
            throw cause;
          },
        }),
      }),
    { code: "STEP_EXECUTION_FAILED", cause },
  );
});
