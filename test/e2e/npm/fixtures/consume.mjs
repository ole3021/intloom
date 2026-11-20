import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compiledLoomSchema } from "@intloom/loom-sdk";

const require = createRequire(import.meta.url);
for (const [name, kind] of [
  ["code-report", "code"],
  ["agent-research", "agent"],
  ["workflow-report", "workflow"],
  ["hello-loom", "workflow"],
  ["meeting-notes", "code"],
  ["intent-loom", "workflow"],
]) {
  const manifestFile = require.resolve(`@intloom-example/${name}/loom.json`);
  const manifest = compiledLoomSchema.parse(
    JSON.parse(readFileSync(manifestFile, "utf8")),
  );
  assert.equal(manifest.entry.kind, kind);
  const root = dirname(manifestFile);
  const module = await import(
    pathToFileURL(resolve(root, manifest.entry.module)).href
  );
  const entry = module[manifest.entry.export];
  assert.equal(
    kind === "code" ? typeof entry : entry.kind,
    kind === "code" ? "function" : kind,
  );
  const exported = await import(`@intloom-example/${name}`);
  assert.equal(exported[manifest.entry.export], entry);
  if (name === "code-report") {
    let output;
    await entry(
      { prompt: "Archive consumer" },
      {
        mode: "run",
        workDir: "/work",
        fs: {
          write: async (input) => {
            output = input;
          },
        },
      },
    );
    assert.deepEqual(output, {
      path: "/work/summary.md",
      content: "# Report\n\nArchive consumer\n",
    });
  }
  if (kind === "agent") {
    assert.ok(
      (
        await entry.instructions({
          mode: "run",
          prompt: "test",
          workDir: "/work",
        })
      ).includes("/work"),
    );
    assert.deepEqual(
      module.reviewer.returns.parse({ passed: true, issues: [] }),
      { passed: true, issues: [] },
    );
    assert.match(
      readFileSync(
        resolve(root, "skills/research/references/evidence.md"),
        "utf8",
      ),
      /Attribute/,
    );
    assert.match(
      readFileSync(
        resolve(root, "skills/research/assets/report-template.md"),
        "utf8",
      ),
      /Findings/,
    );
    assert.match(
      readFileSync(resolve(root, "assets/report-template.md"), "utf8"),
      /Sources/,
    );
  }
  if (name === "workflow-report") {
    assert.equal(typeof entry.steps[1].next[0].when, "function");
    assert.equal(entry.steps[2].kind, "repeat");
    assert.equal(entry.steps[2].max, 3);
    assert.equal(typeof entry.steps[3].when, "function");
  }
  if (name === "hello-loom") {
    assert.deepEqual(
      entry.steps.map((step) => step.name),
      ["ask-name", "local-weather", "write-greeting"],
    );
  }
  if (name === "meeting-notes") {
    assert.equal(typeof module.minutes.instructions, "function");
    assert.match(
      await module.minutes.instructions(),
      /Copy quotations character for character/,
    );
    assert.ok(module.minutes.returns);
    assert.ok(readFileSync(resolve(root, "samples/rollout-review.txt")).length);
  }
  if (name === "intent-loom") {
    assert.deepEqual(
      entry.steps.map((step) => step.kind),
      ["step", "repeat", "repeat", "step", "step"],
    );
    for (const step of entry.steps.slice(1, 3)) {
      assert.equal(step.max, 5);
      assert.equal(step.exec.kind, "workflow");
      assert.equal(typeof step.exec.mapResult, "function");
      assert.equal(typeof step.until, "function");
      assert.equal(typeof step.nextInput, "function");
    }
    assert.equal(manifest.skills[0].metadata.name, "evidence-review");
    assert.match(
      readFileSync(
        resolve(root, "skills/evidence-review/references/evidence.md"),
        "utf8",
      ),
      /candidate digest/,
    );
    const roles = await import("@intloom-example/intent-loom/src/agents.js");
    for (const role of Object.values(roles)) {
      assert.equal(typeof role.instructions, "function");
      assert.ok((await role.instructions()).length > 40);
      assert.ok(role.returns);
    }
  }
}
