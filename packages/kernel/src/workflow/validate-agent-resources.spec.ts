import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { agentSpec } from "../../test/agent-fixture.ts";
import {
  agentId,
  source,
  workflowModule,
} from "../../test/workflow-fixture.ts";
import { validateWorkflow } from "./validate-workflow.ts";
import { validateAgentResources } from "./validate-agent-resources.ts";

test("model-free loading still rejects damaged Skill resources and metadata", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-skill-resources-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const skill = {
    name: "review",
    description: "Review changes",
    content: "Review",
    assets: ["SKILL.md"],
  };
  const loaded = (skills = [skill]) =>
    validateWorkflow(
      { ...source, assetRoot: root },
      {
        ...workflowModule(),
        agentSpecs: { [agentId]: { ...agentSpec(), skills } },
      },
    );
  for (const text of [
    "no metadata",
    "---\nname: other\ndescription: Review changes\n---\nReview",
    "---\nname: review\nname: review\ndescription: Review changes\n---\nReview",
  ]) {
    await writeFile(join(root, "SKILL.md"), text);
    await assert.rejects(validateAgentResources(loaded()), {
      code: "INVALID_WORKFLOW",
    });
  }
  await writeFile(
    join(root, "SKILL.md"),
    "---\nname: review\ndescription: Review changes\n---\nReview",
  );
  await validateAgentResources(loaded());
  await assert.rejects(
    validateAgentResources(loaded([skill, skill])),
    /Duplicate Skill name/,
  );
  await assert.rejects(
    validateAgentResources(loaded([{ ...skill, assets: ["reference.md"] }])),
    /Missing or ambiguous/,
  );
  await assert.rejects(
    validateAgentResources(
      loaded([{ ...skill, assets: ["SKILL.md", "other/SKILL.md"] }]),
    ),
    /Missing or ambiguous/,
  );
});
