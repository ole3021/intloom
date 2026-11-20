import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { build, check } from "../src/index.ts";

async function fixture(t: TestContext, name = "code-report") {
  const root = await mkdtemp(join(tmpdir(), "intloom-project-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL(`../../../examples/${name}/`, import.meta.url), root, {
    recursive: true,
    filter: (source) =>
      !["node_modules", "dist", ".turbo"].some((part) =>
        source.split(/[\\/]/).includes(part),
      ),
  });
  await symlink(
    fileURLToPath(new URL("../node_modules", import.meta.url)),
    join(root, "node_modules"),
    "junction",
  );
  return root;
}

test("check leaves formal output untouched, build replaces it, and failed builds preserve the last success", async (t) => {
  const root = await fixture(t);
  const first = await check({ projectDir: root });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal((await readdir(root)).includes("dist"), false);
  const built = await build({ projectDir: root });
  assert.equal(built.ok, true, JSON.stringify(built));
  const manifestFile = join(root, "dist/loom.json");
  const original = await readFile(manifestFile, "utf8");
  await writeFile(join(root, "dist/old.txt"), "stale artifact");
  assert.equal((await check({ projectDir: root })).ok, true);
  assert.equal(
    await readFile(join(root, "dist/old.txt"), "utf8"),
    "stale artifact",
  );
  assert.equal((await build({ projectDir: root })).ok, true);
  assert.equal((await readdir(join(root, "dist"))).includes("old.txt"), false);
  await writeFile(
    join(root, "src/main.ts"),
    "export default async (input: number) => input;",
  );
  const failed = await build({ projectDir: root });
  assert.equal(failed.ok, false);
  assert.ok(failed.diagnostics.some((item) => item.code.startsWith("TS")));
  assert.equal(await readFile(manifestFile, "utf8"), original);
  assert.equal(
    (await readdir(root)).some((name) => name.startsWith(".intloom-prepare-")),
    false,
  );
});

test("fresh inspection sees changed transitive definitions and never executes callbacks", async (t) => {
  const root = await fixture(t);
  const yaml = await readFile(join(root, "loom.yaml"), "utf8");
  await writeFile(
    join(root, "loom.yaml"),
    yaml.replace("./src/main.ts", "./src/main.ts#default"),
  );
  await writeFile(
    join(root, "src/main.ts"),
    'export { default } from "./agent.ts";',
  );
  const agentFile = join(root, "src/agent.ts");
  await writeFile(
    agentFile,
    'import { agent } from "@intloom/loom-sdk"; export default agent({ instructions: async () => { throw new Error("must not invoke"); } });',
  );
  assert.equal((await check({ projectDir: root })).ok, true);
  await writeFile(
    agentFile,
    'import { agent } from "@intloom/loom-sdk"; export default agent({ instructions: "" });',
  );
  const invalid = await check({ projectDir: root });
  assert.equal(invalid.ok, false);
  assert.ok(
    invalid.diagnostics.some((item) => item.code === "INVALID_DECLARATION"),
  );
  await writeFile(
    agentFile,
    'throw new Error("top-level failure"); export default async () => {};',
  );
  const load = await check({ projectDir: root });
  assert.equal(load.ok, false);
  assert.ok(
    load.diagnostics.some(
      (item) =>
        item.code === "DEFINITION_LOAD" &&
        item.message.includes("top-level failure"),
    ),
  );
});

test("Agent and Workflow examples build executable definitions and complete Skill trees", async (t) => {
  for (const name of ["agent-research", "workflow-report"]) {
    const root = await fixture(t, name);
    const result = await build({ projectDir: root });
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.inspection.codeCalls, "dynamic");
    assert.ok(
      result.inspection.components.some(
        (component) => component.kind === "agent",
      ),
    );
    assert.ok(
      result.inspection.components.every(
        (component) => !component.module.startsWith("/"),
      ),
    );
    if (name === "workflow-report") {
      assert.ok(
        result.inspection.components.some(
          (component) =>
            component.kind === "workflow" && component.path.includes("polish"),
        ),
      );
    }
    assert.equal(
      result.manifest.entry.kind,
      name === "agent-research" ? "agent" : "workflow",
    );
    const metadata = JSON.parse(
      await readFile(join(root, "dist/package.json"), "utf8"),
    );
    assert.equal(metadata.loom, "./loom.json");
    assert.equal(metadata.devDependencies, undefined);
    if (name === "agent-research") {
      assert.equal(result.manifest.skills[0]?.metadata.name, "research");
      assert.match(
        await readFile(
          join(root, "dist/skills/research/references/evidence.md"),
          "utf8",
        ),
        /Attribute/,
      );
      assert.match(
        await readFile(join(root, "dist/assets/report-template.md"), "utf8"),
        /Sources/,
      );
    }
  }
});

test("invalid references, resources, Skills, platform tools and Workflow targets have diagnostics", async (t) => {
  const root = await fixture(t, "agent-research");
  const yamlFile = join(root, "loom.yaml");
  const yaml = await readFile(yamlFile, "utf8");
  await writeFile(
    yamlFile,
    yaml.replace("./src/assistant.ts#researcher", "./src/missing.ts"),
  );
  assert.ok(
    (await check({ projectDir: root })).diagnostics.some(
      (item) => item.code === "MISSING_MODULE",
    ),
  );
  await writeFile(
    yamlFile,
    yaml.replace("./assets/report-template.md", "./assets/missing.md"),
  );
  assert.ok(
    (await check({ projectDir: root })).diagnostics.some(
      (item) => item.code === "MISSING_RESOURCE",
    ),
  );
  await writeFile(yamlFile, yaml);
  const skillFile = join(root, "skills/research/SKILL.md");
  const skill = await readFile(skillFile, "utf8");
  await writeFile(skillFile, skill.replace("name: research", "name: other"));
  assert.ok(
    (await check({ projectDir: root })).diagnostics.some(
      (item) => item.code === "INVALID_SKILL",
    ),
  );
  await writeFile(skillFile, skill);
  const source = join(root, "src/assistant.ts");
  await writeFile(
    source,
    (await readFile(source, "utf8")).replace(
      'read: "fs.read"',
      'startRun: "fs.read"',
    ),
  );
  assert.ok(
    (await check({ projectDir: root })).diagnostics.some(
      (item) => item.code === "PLATFORM_TOOL_CONFLICT",
    ),
  );
  const flow = await fixture(t, "workflow-report");
  const flowFile = join(flow, "src/report.ts");
  await writeFile(
    flowFile,
    (await readFile(flowFile, "utf8")).replace('to: "save"', 'to: "draft"'),
  );
  assert.ok(
    (await check({ projectDir: flow })).diagnostics.some((item) =>
      item.message.includes("later step"),
    ),
  );
});

test("the compiler rejects undeclared runtime dependencies and does not overwrite an unrelated directory", async (t) => {
  const root = await fixture(t);
  await writeFile(
    join(root, "src/main.ts"),
    'import { z } from "zod"; export default async () => { z.string().parse("ok"); };',
  );
  assert.ok(
    (await check({ projectDir: root })).diagnostics.some(
      (item) => item.code === "UNDECLARED_DEPENDENCY",
    ),
  );
  await writeFile(join(root, "src/main.ts"), "export default async () => {};");
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist/user.txt"), "keep");
  assert.equal((await build({ projectDir: root })).ok, false);
  assert.equal(await readFile(join(root, "dist/user.txt"), "utf8"), "keep");
});
