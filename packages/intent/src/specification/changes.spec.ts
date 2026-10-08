import assert from "node:assert/strict";
import { test } from "node:test";
import type { SpecificationArtifact } from "../../schemas/specification-artifact.ts";
import type { SpecificationChange } from "../../schemas/specification-record.ts";
import { applyChanges, emptyArtifact, validateArtifact } from "./changes.ts";

function baseline(): SpecificationArtifact {
  return {
    ...emptyArtifact(),
    domains: [{ id: "SDOM-a", responsibility: "Domains", status: "active" }],
    features: [
      {
        id: "SFEA-a",
        responsibility: "Features",
        status: "active",
        domain_ref: "SDOM-a",
      },
    ],
    requirements: [
      {
        id: "SREQ-a",
        description: "Original requirement",
        status: "active",
        feature_ref: "SFEA-a",
        acceptances: [
          {
            id: "SACC-a",
            requirement_ref: "SREQ-a",
            description: "Original acceptance criterion",
          },
        ],
        record_refs: ["RUN-old"],
      },
    ],
  };
}
test("patches preserve baseline, update parent provenance and collect existing origins", () => {
  const source = baseline();
  const original = structuredClone(source);
  const result = applyChanges(
    source,
    [
      {
        target_ref: "SACC-a",
        reason: "Add an acceptance criterion",
        patch: [
          {
            op: "test",
            path: "/description",
            value: "Original acceptance criterion",
          },
          {
            op: "replace",
            path: "/description",
            value: "New acceptance criterion",
          },
        ],
      },
    ],
    "RUN-new",
  );
  assert.deepEqual(source, original);
  assert.deepEqual(result.artifact.requirements[0]?.record_refs, [
    "RUN-old",
    "RUN-new",
  ]);
  assert.deepEqual(result.originRefs, ["SACC-a", "SREQ-a"]);
});
test("new objects start with empty record_refs and Finalize adds the run", () => {
  const result = applyChanges(
    emptyArtifact(),
    [
      {
        target_ref: "SCON-a",
        reason: "User request",
        patch: [
          {
            op: "add",
            path: "",
            value: {
              id: "SCON-a",
              description: "Response limit",
              status: "active",
              record_refs: [],
            },
          },
        ],
      },
    ],
    "RUN-new",
  );
  assert.deepEqual(result.artifact.constraints[0]?.record_refs, ["RUN-new"]);
  assert.deepEqual(result.originRefs, []);
});
for (const [label, patch] of [
  [
    "missing test",
    [{ op: "replace", path: "/description", value: "New requirement" }],
  ],
  [
    "wrong old value",
    [
      { op: "test", path: "/description", value: "Incorrect value" },
      { op: "replace", path: "/description", value: "New requirement" },
    ],
  ],
  [
    "overwrite with add",
    [{ op: "add", path: "/description", value: "New requirement" }],
  ],
  [
    "managed provenance",
    [
      { op: "test", path: "/record_refs", value: ["RUN-old"] },
      { op: "replace", path: "/record_refs", value: [] },
    ],
  ],
  [
    "identity change",
    [
      { op: "test", path: "/id", value: "SREQ-a" },
      { op: "replace", path: "/id", value: "SREQ-b" },
    ],
  ],
  [
    "acceptance collection",
    [
      { op: "test", path: "/acceptances", value: [] },
      { op: "replace", path: "/acceptances", value: [] },
    ],
  ],
  ["prototype path", [{ op: "add", path: "/__proto__/polluted", value: true }]],
  [
    "no effect",
    [{ op: "test", path: "/description", value: "Original requirement" }],
  ],
] satisfies [string, SpecificationChange["patch"]][])
  test(`rejects ${label}`, () => {
    assert.throws(() =>
      applyChanges(
        baseline(),
        [{ target_ref: "SREQ-a", reason: "Test", patch }],
        "RUN-new",
      ),
    );
  });
test("removed acceptance IDs cannot be reused in the same change set", () => {
  const source = baseline();
  const acceptance = source.requirements[0]?.acceptances[0];
  assert.ok(acceptance);
  assert.throws(
    () =>
      applyChanges(
        source,
        [
          {
            target_ref: "SACC-a",
            reason: "Remove",
            patch: [
              { op: "test", path: "", value: acceptance },
              { op: "remove", path: "" },
            ],
          },
          {
            target_ref: "SACC-a",
            reason: "Reuse",
            patch: [{ op: "add", path: "", value: acceptance }],
          },
        ],
        "RUN-new",
      ),
    /already used/,
  );
});
test("duplicate IDs, dangling references and wrong acceptance ownership are rejected", () => {
  const duplicate = baseline();
  const domain = duplicate.domains[0];
  assert.ok(domain);
  duplicate.domains.push(structuredClone(domain));
  assert.throws(() => validateArtifact(duplicate), /Duplicate/);
  const dangling = baseline();
  const feature = dangling.features[0];
  assert.ok(feature);
  feature.domain_ref = "SDOM-missing";
  assert.throws(() => validateArtifact(dangling), /reference/);
  const parent = baseline();
  const acceptance = parent.requirements[0]?.acceptances[0];
  assert.ok(acceptance);
  acceptance.requirement_ref = "SREQ-other";
  assert.throws(() => validateArtifact(parent), /parent/);
});

test("opposing changes with no net effect are rejected", () => {
  assert.throws(
    () =>
      applyChanges(
        baseline(),
        [
          {
            target_ref: "SREQ-a",
            reason: "Revise",
            patch: [
              {
                op: "test",
                path: "/description",
                value: "Original requirement",
              },
              {
                op: "replace",
                path: "/description",
                value: "Temporary requirement",
              },
            ],
          },
          {
            target_ref: "SREQ-a",
            reason: "Revert",
            patch: [
              {
                op: "test",
                path: "/description",
                value: "Temporary requirement",
              },
              {
                op: "replace",
                path: "/description",
                value: "Original requirement",
              },
            ],
          },
        ],
        "RUN-new",
      ),
    /net effect/,
  );
});
