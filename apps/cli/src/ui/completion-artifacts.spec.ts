import assert from "node:assert/strict";
import { test } from "node:test";
import { showCompletionArtifacts } from "./completion-artifacts.ts";
import { artifactListCommand } from "./artifacts.ts";
import { terminal, view } from "../../test/unit-fixture.ts";
import { artifact } from "../../test/artifact-fixture.ts";
import { failure } from "../errors.ts";

test("completed output labels query-time metadata without changing the Run or inferring Records", async () => {
  const ui = terminal([], false);
  const completed = Object.freeze({
    ...view,
    status: "completed" as const,
    pendingAction: undefined,
  });
  const { pendingAction: _action, ...run } = completed;
  const original = structuredClone(run);
  const { data: _data, ...summary } = artifact;
  await showCompletionArtifacts(
    {
      listArtifacts: async (query) => {
        assert.deepEqual(query, { flowName: run.flowName });
        return { data: [summary] };
      },
    },
    run,
    ui.ui,
  );
  assert.deepEqual(run, original);
  assert.match(ui.stdout, /Current committed artifacts at query time/u);
  assert.match(ui.stdout, /intloom artifact ART-todo/u);
  assert.doesNotMatch(ui.stdout, /REC-|committed by this Run/u);
});
test("completion query failures retain completed behavior and expose only safe errors", async () => {
  const ui = terminal([], false);
  const { pendingAction: _action, ...run } = {
    ...view,
    status: "completed" as const,
  };
  await showCompletionArtifacts(
    {
      listArtifacts: async () => {
        throw failure(
          "CLI_SERVICE_UNAVAILABLE",
          "Query unavailable",
          new Error("private credential"),
        );
      },
    },
    run,
    ui.ui,
  );
  assert.equal(run.status, "completed");
  assert.match(
    ui.stdout,
    /The Run completed, but querying current committed artifacts failed/u,
  );
  assert.match(ui.stdout, /intloom artifacts --flow test/u);
  assert.doesNotMatch(ui.stdout, /private credential/u);
});
test("waiting and JSON results do not perform additional completion queries", async () => {
  const client = {
    listArtifacts: async (): Promise<never> => {
      throw new Error("Must not query");
    },
  };
  const normal = terminal([], false);
  await showCompletionArtifacts(client, view, normal.ui);
  const json = terminal([], false, true);
  const { pendingAction: _action, ...completed } = {
    ...view,
    status: "completed" as const,
  };
  await showCompletionArtifacts(client, completed, json.ui);
  assert.equal(normal.stdout, "");
  assert.equal(json.stdout, "");
});
test("query hints quote shell metacharacters and retain pagination filters", () => {
  const command = artifactListCommand({
    flowName: "todo's $(touch marker)",
    stageName: "first stage",
    limit: 1,
    cursor: "cursor",
  });
  assert.equal(
    command,
    "intloom artifacts --flow 'todo'\\''s $(touch marker)' --stage 'first stage' --limit 1 --cursor cursor",
  );
  assert.equal(
    artifactListCommand({ flowName: "fixture" }, "/tmp/project with spaces"),
    "intloom artifacts --flow fixture --project '/tmp/project with spaces'",
  );
});
