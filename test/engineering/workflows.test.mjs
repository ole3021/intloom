import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { parseDocument } from "yaml";

test("workflow declarations parse, reference existing jobs and keep releases paused", () => {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expressions are literal YAML values.
  const paused = "${{ false }}";
  const directory = new URL("../../.github/workflows/", import.meta.url);
  for (const name of readdirSync(directory)) {
    const document = parseDocument(
      readFileSync(new URL(name, directory), "utf8"),
    );
    assert.deepEqual(document.errors, [], name);
    const workflow = document.toJS();
    for (const job of Object.values(workflow.jobs)) {
      const needs =
        typeof job.needs === "string" ? [job.needs] : (job.needs ?? []);
      for (const dependency of needs) {
        assert.ok(
          workflow.jobs[dependency],
          `${name}: unknown job ${dependency}`,
        );
      }
    }
    if (name === "verify.yml") {
      assert.ok(workflow.jobs.verify);
      assert.ok(workflow.jobs["npm-consumers"]);
    } else {
      assert.equal(workflow.jobs.select.if, paused, name);
      if (name === "app-release.yml") {
        assert.equal(workflow.jobs.installers.if, paused, name);
      }
    }
  }
});
