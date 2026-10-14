import assert from "node:assert/strict";
import { test } from "node:test";
import { runScope } from "./scope.ts";
const specification = {
  constraints: [
    { id: "SCON-a", description: "A", status: "active" },
    { id: "SCON-b", description: "B", status: "active" },
  ],
};
const solution = {
  concepts: [
    { id: "OCON-a", constraint_refs: ["SCON-a"], status: "active" },
    { id: "OCON-b", constraint_refs: ["SCON-b"], status: "active" },
  ],
};
const implementation = {
  initialSnapshot: { "src/a.ts": "old" },
  fileSnapshot: { "src/a.ts": "new" },
  changes: [{ paths: [{ path: "src/a.ts" }], origin_refs: ["OCON-a"] }],
};
const changes = [
  {
    target_ref: "SCON-a",
    patch: [
      {
        op: "replace" as const,
        path: "/description" as const,
        value: "Updated A",
      },
    ],
  },
];
test("run coverage includes direct changes, code origins and related objects but not unrelated history", () => {
  const result = runScope(
    specification,
    solution,
    changes,
    implementation,
    false,
  );
  assert.deepEqual(
    result.scope.specification.map((t) => t.ref),
    ["SCON-a"],
  );
  assert.deepEqual(
    result.scope.solution.map((t) => t.ref),
    ["OCON-a"],
  );
  assert.equal(result.scopeMode, "run");
});
test("first run, unassociated code and shared configuration require full coverage", () => {
  for (const [first, input] of [
    [true, implementation],
    [false, { ...implementation, changes: [] }],
    [
      false,
      {
        ...implementation,
        fileSnapshot: { ...implementation.fileSnapshot, "package.json": "new" },
      },
    ],
  ] as const) {
    const result = runScope(specification, solution, changes, input, first);
    assert.equal(result.scopeMode, "full");
    assert.equal(result.scope.specification.length, 2);
    assert.equal(result.scope.solution.length, 2);
  }
});
test("retirement and deleted acceptances remain required checks with original context", () => {
  const removed = {
    id: "SACC-old",
    requirement_ref: "SREQ-a",
    description: "Old acceptance",
  };
  const spec = {
    requirements: [{ id: "SREQ-a", status: "retired", acceptances: [] }],
  };
  const result = runScope(
    spec,
    {},
    [
      {
        target_ref: "SREQ-a",
        patch: [{ op: "replace", path: "/status", value: "retired" }],
      },
      {
        target_ref: "SACC-old",
        patch: [
          { op: "test", path: "", value: removed },
          { op: "remove", path: "" },
        ],
      },
    ],
    { initialSnapshot: {}, fileSnapshot: {}, changes: [] },
    false,
  );
  assert.deepEqual(
    result.scope.specification.map((t) => t.ref),
    ["SACC-old", "SREQ-a"],
  );
  assert.deepEqual(result.scopeContext["SACC-old"], {
    ...removed,
    removed: true,
  });
});

test("adding a module through its container does not revalidate unrelated unchanged modules", () => {
  const old = {
    id: "OMOD-old",
    parent_ref: "OAPP-app",
    requirement_refs: ["SCON-b"],
    status: "active",
  };
  const added = {
    id: "OMOD-new",
    parent_ref: "OAPP-app",
    requirement_refs: ["SCON-a"],
    status: "active",
  };
  const result = runScope(
    specification,
    { apps: [{ id: "OAPP-app", modules: [old, added] }] },
    [
      {
        target_ref: "OAPP-app",
        patch: [
          { op: "test", path: "/modules", value: [old] },
          { op: "replace", path: "/modules", value: [old, added] },
        ],
      },
    ],
    { initialSnapshot: {}, fileSnapshot: {}, changes: [] },
    false,
  );
  assert.deepEqual(
    result.scope.solution.map((t) => t.ref),
    ["OAPP-app", "OMOD-new"],
  );
  assert.deepEqual(
    result.scope.specification.map((t) => t.ref),
    ["SCON-a"],
  );
});

test("implementation origins inside interfaces and scenario steps require their nearest report target", () => {
  const design = {
    apps: [
      {
        id: "OAPP-app",
        modules: [
          {
            id: "OMOD-one",
            interfaces: [{ id: "OMOD-one-INT-read" }],
            requirement_refs: ["SCON-a"],
          },
          {
            id: "OMOD-other",
            interfaces: [{ id: "OMOD-other-INT-read" }],
            requirement_refs: ["SCON-b"],
          },
        ],
      },
    ],
    scenarios: [{ id: "OSCN-one", steps: [{ id: "OSCN-one-STEP-1" }] }],
  };
  for (const [origin, expected, spec] of [
    ["OMOD-one-INT-read", "OMOD-one", ["SCON-a"]],
    ["OSCN-one-STEP-1", "OSCN-one", []],
  ] as const) {
    const result = runScope(
      specification,
      design,
      [],
      {
        ...implementation,
        changes: [{ paths: [{ path: "src/a.ts" }], origin_refs: [origin] }],
      },
      false,
    );
    assert.equal(result.scopeMode, "run");
    assert.deepEqual(
      result.scope.solution.map((t) => t.ref),
      [expected],
    );
    assert.deepEqual(
      result.scope.specification.map((t) => t.ref),
      spec,
    );
    assert.deepEqual(result.scopeReasons[expected], ["implementation_change"]);
  }
});

test("related references to nested interfaces and requirement acceptances remain required", () => {
  const result = runScope(
    {
      requirements: [
        {
          id: "SREQ-one",
          acceptances: [{ id: "SACC-one", requirement_ref: "SREQ-one" }],
        },
      ],
    },
    {
      modules: [{ id: "OMOD-one", interfaces: [{ id: "OMOD-one-INT-read" }] }],
      scenarios: [{ id: "OSCN-one", interface_ref: "OMOD-one-INT-read" }],
      concepts: [{ id: "OCON-one", acceptance_ref: "SACC-one" }],
    },
    [{ target_ref: "SREQ-one", patch: [] }],
    {
      ...implementation,
      changes: [
        { paths: [{ path: "src/a.ts" }], origin_refs: ["OMOD-one-INT-read"] },
      ],
    },
    false,
  );
  assert.deepEqual(
    result.scope.specification.map((t) => t.ref),
    ["SACC-one", "SREQ-one"],
  );
  assert.deepEqual(
    result.scope.solution.map((t) => t.ref),
    ["OCON-one", "OMOD-one", "OSCN-one"],
  );
});

test("code origins without a reportable owner conservatively require full coverage", () => {
  const result = runScope(
    { id: "RUN-root", ...specification },
    solution,
    [],
    {
      ...implementation,
      changes: [{ paths: [{ path: "src/a.ts" }], origin_refs: ["RUN-root"] }],
    },
    false,
  );
  assert.equal(result.scopeMode, "full");
  assert.equal(result.scope.specification.length, 2);
  assert.equal(result.scope.solution.length, 2);
});
