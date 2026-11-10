import { cliArgs } from "../fixtures/cli.mjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
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
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { loadConfiguration } from "../../packages/kernel/dist/execution/config.js";
import {
  resolveCredential,
  selectBindings,
} from "../../packages/kernel/dist/execution/bindings.js";
import { serve } from "../../packages/kernel/dist/index.js";
import type { LoomManifest } from "../../packages/loom-sdk/dist/index.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const exec = promisify(execFile);

test("the global Loom store ignores project npm installations and preserves exact Run history after removal", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "intloom-npm-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const author = join(dir, "author"),
    project = join(dir, "project"),
    dataDir = join(dir, "host");
  await mkdir(join(author, "writing/style/references"), { recursive: true });
  await mkdir(project);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(author, "node_modules"),
  );
  await writeFile(
    join(author, "package.json"),
    JSON.stringify({
      type: "module",
      name: "@example/planner",
      version: "1.0.0",
      description: "stale author description",
      license: "MIT",
      repository: { type: "git", url: "https://example.org/repo.git" },
      files: ["README.md", "LICENSE"],
      scripts: { postinstall: "exit 1" },
    }),
  );
  await writeFile(
    join(author, "README.md"),
    "Input a destination. Expect a short plan.",
  );
  await writeFile(join(author, "LICENSE"), "Fixture license");
  await writeFile(join(author, "draft-notes.txt"), "private draft");
  await writeFile(
    join(author, "planner.md"),
    "---\nname: planner\ndescription: Plan a trip\n---\nReturn a short plan.\n",
  );
  await writeFile(
    join(author, "writing/style/SKILL.md"),
    "---\nname: style\ndescription: Review a plan\n---\nRead references/check.md.\n",
  );
  await writeFile(
    join(author, "writing/style/references/check.md"),
    "preserved",
  );
  await writeFile(
    join(author, "loom.ts"),
    `
    import {defineLoom,defineAgent} from "@intloom/loom-sdk";
    import agent from "intloom:agent/planner.md";
    import skill from "intloom:skill/writing/style";
    import {z} from "zod";
    export default defineLoom({id:"@example/planner",name:"Plan writer",version:"1.0.0",description:"A plan",entry:defineAgent({
      ...agent,skills:[skill],model:{slot:"writer",profile:"thinking"},inputSchema:z.string(),outputSchema:z.string(),outputMode:"text",prompt:({inputData})=>inputData
    })});`,
  );
  const { stdout } = await exec(
    process.execPath,
    [
      ...cliArgs(join(root, "apps/cli/dist/bin.js"), dataDir),
      "dev",
      "build",
      "--plain",
    ],
    { cwd: author },
  );
  const { archiveFile, root: ref } = JSON.parse(stdout).data;
  assert.deepEqual(await readdir(join(author, "dist")), [
    "example-planner-1.0.0.tgz",
  ]);
  const inspection = JSON.parse(
    (
      await exec(
        process.execPath,
        [
          ...cliArgs(join(root, "apps/cli/dist/bin.js"), dataDir),
          "loom",
          "describe",
          archiveFile,
          "--plain",
        ],
        { cwd: project },
      )
    ).stdout,
  ).data;
  assert.equal(inspection.root.npmName, "@example/planner");
  assert.equal(inspection.root.artifactDigest, ref.artifactDigest);
  assert.deepEqual(inspection.root.requirements.models, { writer: [] });
  assert.ok(inspection.root.files.includes("skills/style/references/check.md"));
  assert.ok(inspection.root.files.includes("README.md"));
  assert.ok(!inspection.root.files.includes("draft-notes.txt"));
  assert.deepEqual(inspection.dependencies, []);
  await assert.rejects(readdir(dataDir), { code: "ENOENT" });
  await writeFile(join(project, "package.json"), '{"private":true}');
  await exec(
    "npm",
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      archiveFile,
    ],
    {
      cwd: project,
      env: { ...process.env, npm_config_cache: join(dir, "npm-cache") },
    },
  );
  const installed = join(project, "node_modules/@example/planner");
  assert.equal(
    await readFile(join(installed, "skills/style/references/check.md"), "utf8"),
    "preserved",
  );
  const metadata = JSON.parse(
    await readFile(join(installed, "package.json"), "utf8"),
  );
  assert.equal(metadata.engines.node, "^22.22.0 || ^24.0.0 || ^26.0.0");
  assert.equal(inspection.root.requirements.node, metadata.engines.node);
  assert.equal(metadata.description, "A plan");
  assert.equal(metadata.license, "MIT");
  assert.equal(metadata.repository.url, "https://example.org/repo.git");
  assert.equal(metadata.scripts, undefined);
  assert.equal(
    await readFile(join(installed, "LICENSE"), "utf8"),
    "Fixture license",
  );
  const host = await serve({ dataDir, projectDir: project });
  t.after(() => host.close());
  const broken = join(project, "node_modules", "unrelated-broken");
  await mkdir(broken);
  await writeFile(join(broken, "loom.json"), "broken unrelated manifest");
  assert.deepEqual(await host.getLoomCatalog(), []);
  await assert.rejects(host.getLoom({ id: "@example/planner" }), {
    code: "LOOM_NOT_FOUND",
  });
  assert.deepEqual(await host.installLoom({ source: archiveFile }), ref);
  assert.ok(
    (await host.getLoomCatalog()).some(
      (entry) => entry.ref.artifactDigest === ref.artifactDigest,
    ),
  );
  await rm(broken, { recursive: true });
  const item = await host.getLoom({ id: "@example/planner" });
  assert.deepEqual(item.ref, ref);
  assert.equal(item.manifest.name, "Plan writer");
  assert.equal(item.manifest.components.planner?.model?.profile, "thinking");
  assert.equal(item.manifest.components.planner?.description, "Plan a trip");
  await assert.rejects(host.createRun({ loom: ref, input: "draft" }), {
    code: "BINDING_UNAVAILABLE",
  });
  await writeFile(
    join(project, "intloom.yaml"),
    "version: 1\nmodels:\n  ordinary: {provider: openai, model: gpt-4.1-mini, credentialRef: 'env:UNUSED'}\nprofiles: {default: ordinary}\n",
  );
  const created = await host.createRun({ loom: ref, input: "draft" });
  await rm(installed, { recursive: true });
  assert.equal((await host.listLooms({ id: ref.id })).items.length, 1);
  await host.removeLoom(ref.id);
  assert.deepEqual(await host.getLoomCatalog(), []);
  assert.deepEqual(
    (await host.getLoomCatalog([ref])).map((item) => item.ref),
    [ref],
  );
  for (const loom of [
    { id: ref.id },
    { id: ref.id, version: ref.version },
    { artifactDigest: ref.artifactDigest },
  ])
    assert.deepEqual(
      (await host.listRuns({ loom })).items.map((run) => run.id),
      [created.id],
    );
  assert.deepEqual(
    (await host.listRuns({ loom: { id: "missing" } })).items,
    [],
  );
  assert.equal(
    (await host.listLooms({ id: "@example/planner" })).items.length,
    0,
  );
  assert.equal(
    (await host.getRun(created.id)).loom.artifactDigest,
    ref.artifactDigest,
  );
  assert.equal(
    await readFile(
      join(
        dataDir,
        "packages",
        ref.artifactDigest,
        "skills/style/references/check.md",
      ),
      "utf8",
    ),
    "preserved",
  );
  assert.deepEqual(await host.installLoom({ source: archiveFile }), ref);
  assert.equal(
    (await host.listLooms({ id: "@example/planner" })).items[0]?.source,
    "intloom",
  );
});

test("global and project YAML replace whole models; exact, profile, default and credential precedence", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "intloom-yaml-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const global = join(dir, "global"),
    project = join(dir, "project");
  await Promise.all([mkdir(global), mkdir(project)]);
  const model = (key: string) => ({
    provider: "openai",
    model: "gpt-4.1-mini",
    credentialRef: `env:${key}`,
  });
  const fixtureKey = "INTLOOM_FIXTURE_KEY";
  const globalConfig = {
    version: 1,
    models: {
      shared: {
        ...model("PREVIOUS"),
        options: { baseUrl: "https://example.invalid" },
      },
      other: model("OTHER"),
    },
    profiles: { default: "shared", thinking: "other" },
    bindings: { "writer@1.0.0": { planner: "other" } },
  };
  await writeFile(join(global, "intloom.yaml"), JSON.stringify(globalConfig));
  await writeFile(
    join(project, "intloom.yaml"),
    JSON.stringify({
      version: 1,
      models: { shared: model(fixtureKey) },
      bindings: { "writer@1.0.0": { planner: "shared" } },
    }),
  );
  await writeFile(join(global, ".env"), `${fixtureKey}=global`);
  const host = await loadConfiguration(project, {}, global);
  const manifest = (id: string, profile: string) =>
    ({
      id,
      version: "1.0.0",
      components: { a: { model: { slot: "planner", profile } } },
      requirements: { models: { planner: [] }, tools: [] },
    }) as unknown as LoomManifest;
  const selected = (id: string, profile: string) =>
    selectBindings(manifest(id, profile), host).descriptions.models.planner;
  assert.deepEqual(selected("writer", "thinking"), model(fixtureKey));
  assert.deepEqual(selected("reader", "thinking"), model("OTHER"));
  assert.deepEqual(selected("reader", "general"), model(fixtureKey));
  const ref = `env:${fixtureKey}`;
  assert.equal(await resolveCredential(host, ref), "global");
  await writeFile(join(project, ".env"), `${fixtureKey}=project`);
  assert.equal(await resolveCredential(host, ref), "project");
  const before = process.env[fixtureKey];
  try {
    process.env[fixtureKey] = "process";
    assert.equal(await resolveCredential(host, ref), "process");
  } finally {
    if (before === undefined) delete process.env[fixtureKey];
    else process.env[fixtureKey] = before;
  }
  await writeFile(
    join(project, "intloom.yaml"),
    "version: 1\nprofiles: {general: nonexistent}",
  );
  await assert.rejects(loadConfiguration(project, {}, global), {
    code: "BINDING_UNAVAILABLE",
  });
});
