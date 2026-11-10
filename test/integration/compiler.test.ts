import { writeFixturePackage } from "./fixture-package.ts";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import {
  compileLoom,
  packLoom,
  resolveLoomDependencies,
} from "../../packages/compiler/dist/index.js";
import { createIntegrity } from "../../packages/loom-sdk/dist/package-format/index.js";
import { stableJson } from "../../packages/loom-sdk/dist/schema/json.js";
import {
  createPackageStore,
  inspectLoomPackage,
} from "../../packages/kernel/dist/index.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const exec = promisify(execFile);
const hasCode = (code: string) => (error: unknown) =>
  (error as { code?: string }).code === code;
async function workspace(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-compiler-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "author"));
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(directory, "author/node_modules"),
  );
  await writeFile(join(directory, "author/package.json"), '{"type":"module"}');
  return directory;
}
async function build(directory: string, source?: string) {
  const entryFile = join(directory, "author/loom.ts");
  if (source) await writeFile(entryFile, source);
  else
    await cp(join(root, "test/fixtures/compiler-simple.ts.fixture"), entryFile);
  await writeFixturePackage(entryFile);
  const result = await compileLoom({
    entryFile,
    outDir: join(directory, "output"),
    target: "node22",
  });
  assert.ok(result.ok, JSON.stringify(result.diagnostics));
  return result;
}

test("compile preserves default views, produces stable portable bytes, and never executes callbacks", async (t) => {
  const directory = await workspace(t);
  const first = await build(directory);
  const second = await build(directory);
  assert.equal(first.artifactDigest, second.artifactDigest);
  await cp(join(directory, "author"), join(directory, "relocated-author"), {
    recursive: true,
  });
  const relocated = await compileLoom({
    entryFile: join(directory, "relocated-author/loom.ts"),
    outDir: join(directory, "relocated-output"),
    target: "node22",
  });
  assert.ok(relocated.ok, JSON.stringify(relocated));
  assert.equal(relocated.artifactDigest, first.artifactDigest);
  assert.deepEqual(first.manifest.contracts.input.required ?? [], []);
  assert.deepEqual(first.manifest.contracts.normalizedInput.required, [
    "count",
  ]);
  const input = first.manifest.contracts.input.properties as Record<
    string,
    { default?: number; minimum?: number }
  >;
  assert.equal(input.count?.default, 3);
  assert.equal(input.count?.minimum, 1);
  const code = await readFile(join(first.artifactDir, "runtime.mjs"), "utf8");
  assert.ok(!code.includes(directory));
  await rm(join(directory, "author"), { recursive: true });
  const result = await exec(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const loom=(await import(${JSON.stringify(pathToFileURL(join(first.artifactDir, "runtime.mjs")).href)})).default; console.log(JSON.stringify({kind:loom.kind,input:loom.entry.inputSchema.parse({})}));`,
    ],
    { cwd: directory },
  );
  assert.deepEqual(JSON.parse(result.stdout), {
    kind: "loom",
    input: { count: 3 },
  });
});

test("inherited ambient types resolve from the author project and explicit typeRoots remain authoritative", async (t) => {
  const directory = await workspace(t);
  await mkdir(join(directory, "node_modules/@types/author-env"), {
    recursive: true,
  });
  await writeFile(
    join(directory, "node_modules/@types/author-env/index.d.ts"),
    "declare const authorValue: string;",
  );
  await writeFile(
    join(directory, "base.json"),
    JSON.stringify({ compilerOptions: { types: ["author-env"] } }),
  );
  await writeFile(
    join(directory, "author/tsconfig.json"),
    JSON.stringify({ extends: "../base.json" }),
  );
  const source = `import {defineCode,defineLoom} from "@intloom/loom-sdk"; import {z} from "zod";
const value: typeof authorValue = "ready";
export default defineLoom({id:"ambient",version:"1.0.0",description:"Ambient types fixture",entry:defineCode({id:"read",inputSchema:z.string(),outputSchema:z.string(),execute:()=>value})});`;
  await build(directory, source);
  await mkdir(join(directory, "custom-types/author-env"), { recursive: true });
  await writeFile(
    join(directory, "custom-types/author-env/index.d.ts"),
    "declare const authorValue: number;",
  );
  await writeFile(
    join(directory, "base.json"),
    JSON.stringify({
      compilerOptions: { types: ["author-env"], typeRoots: ["./custom-types"] },
    }),
  );
  const rejected = await compileLoom({
    entryFile: join(directory, "author/loom.ts"),
    outDir: join(directory, "rejected"),
    target: "node22",
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok)
    assert.match(
      JSON.stringify(rejected.diagnostics),
      /not assignable to type 'number'/,
    );
  await build(
    directory,
    source
      .replace('= "ready"', "= 42")
      .replace("execute:()=>value", "execute:()=>String(value)"),
  );
});

test("projects all component, workflow and interaction declarations with packaged resources", async (t) => {
  const directory = await workspace(t);
  await writeFile(join(directory, "author/guide.md"), "Local guide");
  const result = await build(
    directory,
    await readFile(
      join(root, "test/integration/fixtures/compiler-components.ts.fixture"),
      "utf8",
    ),
  );
  assert.deepEqual(
    Object.values(result.manifest.components)
      .map((c) => c.kind)
      .sort(),
    ["agent", "code", "skill", "tool", "tool", "workflow", "workflow"],
  );
  assert.deepEqual(result.manifest.requirements.models.writer, [
    "structured_output",
    "tool_use",
  ]);
  assert.deepEqual(result.manifest.requirements.tools, ["search"]);
  assert.ok(result.manifest.resources.guide);
  assert.equal(
    await readFile(
      join(result.artifactDir, result.manifest.resources.guide.path),
      "utf8",
    ),
    "Local guide",
  );
  assert.ok(result.manifest.components.flow?.structure);
  const structure = result.manifest.components.flow.structure as {
    kind: string;
    step?: {
      id: string;
      interaction?: { responsePolicy: string };
      resume?: { normalizedInput: { required: string[] } };
    };
  }[];
  assert.deepEqual(
    structure.map((node) => node.kind),
    [
      "then",
      "parallel",
      "map",
      "branch",
      "map",
      "foreach",
      "map",
      "dowhile",
      "dountil",
      "then",
      "then",
    ],
  );
  assert.equal(structure.at(-1)?.step?.interaction?.responsePolicy, "human");
  assert.deepEqual(structure.at(-1)?.step?.resume?.normalizedInput.required, [
    "approved",
  ]);
  await rm(join(directory, "author/guide.md"));
  const missing = await compileLoom({
    entryFile: join(directory, "author/loom.ts"),
    outDir: result.artifactDir,
    target: "node22",
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.diagnostics[0]?.code, "RESOURCE_MISSING");
});

test("compilation rejects unsupported modules, schemas and source errors without replacing good output", async (t) => {
  const directory = await workspace(t);
  const first = await build(directory);
  const original = await readFile(
    join(first.artifactDir, "integrity.json"),
    "utf8",
  );
  const source = await readFile(join(directory, "author/loom.ts"), "utf8");
  // A parent tsconfig may disable checks for a fast editor build; archive compilation must still reject wrong outputs.
  await writeFile(
    join(directory, "author/tsconfig.json"),
    JSON.stringify({ compilerOptions: { noCheck: true, types: [] } }),
  );
  for (const [candidate, expected] of [
    [
      source.replace(
        "z.number().int().min(1), 3",
        "z.number().transform(x => x), 3",
      ),
      "SCHEMA_UNSUPPORTED",
    ],
    [
      source.replace(
        "execute: () => {",
        'execute: () => { const load = (p: string) => import(p); load("missing");',
      ),
      "MODULE_UNSUPPORTED",
    ],
    [
      source.replace(
        'execute: () => { throw new Error("BUSINESS_EXECUTED"); }',
        'execute: () => "wrong"',
      ),
      "TYPECHECK_FAILED",
    ],
    [
      source
        .replace("entry: defineCode", "entry: defineCode")
        .replace('id: "code"', 'id: ""'),
      "DEFINITION_INVALID",
    ],
    [
      source.replace(
        "entry: defineCode",
        'outcome: { artifacts: { report: { at: "/count" } } }, entry: defineCode',
      ),
      "OUTCOME_CONTRACT_INVALID",
    ],
  ] as const) {
    await writeFile(join(directory, "author/loom.ts"), candidate);
    const result = await compileLoom({
      entryFile: join(directory, "author/loom.ts"),
      outDir: first.artifactDir,
      target: "node22",
    });
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0]?.code, expected, JSON.stringify(result));
    if (expected === "SCHEMA_UNSUPPORTED")
      assert.equal(result.diagnostics[0]?.path, "withDefault.schema");
    assert.equal(
      await readFile(join(first.artifactDir, "integrity.json"), "utf8"),
      original,
    );
  }
});

test("generated types cover finite schema composition and outcome pointers retain definite relationships", async (t) => {
  const directory = await workspace(t);
  const source = `import {defineCode,defineLoom,ArtifactRefSchema,AcceptanceRefSchema,withDefault} from "@intloom/loom-sdk"; import {z} from "zod";
    const input=z.object({pair:z.tuple([z.string(),z.number()]),record:z.record(z.enum(["a","b"]),z.number()),choice:z.discriminatedUnion("kind",[z.strictObject({kind:z.literal("yes"),value:z.boolean()}),z.strictObject({kind:z.literal("no"),value:z.null()})]),config:withDefault(z.strictObject({labels:z.array(z.string())}),{labels:["stable"]}),maybe:z.string().nullable().optional(),extra:z.looseObject({fixed:z.string()})});
    export default defineLoom({id:"schemas",version:"1.0.0",description:"Finite schema",outcome:{artifacts:{report:{at:"/deliverable/a~1b"}},acceptance:{at:"/acceptance",subjectAt:"/deliverable",criteria:[{id:"checked",description:"Checked"}]}},entry:defineCode({id:"code",inputSchema:input,outputSchema:z.strictObject({deliverable:z.strictObject({"a/b":ArtifactRefSchema}),acceptance:AcceptanceRefSchema}),execute:()=>{throw new Error("BUSINESS_EXECUTED");}})});`;
  const artifact = await build(directory, source);
  const store = await createPackageStore({ dataDir: join(directory, "data") });
  t.after(() => store.close());
  await store.installLoom({ source: artifact.artifactDir });
  const proof = `import type {InputOf,NormalizedInputOf} from "@intloom/loom-sdk"; import {schema} from "./.intloom/dependencies.ts";
    const raw:InputOf<typeof schema>={pair:["a",1],record:{a:1,b:2},choice:{kind:"no",value:null},extra:{fixed:"yes",arbitrary:3}};
    const normalized:NormalizedInputOf<typeof schema>={...raw,config:{labels:[]}};
    // @ts-expect-error a tuple requires its numeric second item
    const wrongPair:InputOf<typeof schema>={...raw,pair:["a"]};
    // @ts-expect-error enum-key records require all declared keys
    const wrongRecord:InputOf<typeof schema>={...raw,record:{a:1}};
    // @ts-expect-error normalization makes the constant config required
    const missing:NormalizedInputOf<typeof schema>=raw;
    // @ts-expect-error discriminated alternatives retain their value relationship
    const wrongChoice:InputOf<typeof schema>={...raw,choice:{kind:"yes",value:null}};
  `;
  const consumer = source.replace(
    'id:"schemas",version:',
    'id:"consumer",dependencies:{schema:{id:"schemas",version:"1.0.0"}},version:',
  );
  await writeFile(join(directory, "author/loom.ts"), `${consumer}\n${proof}`);
  await writeFixturePackage(join(directory, "author/loom.ts"));
  const result = await compileLoom({
    entryFile: join(directory, "author/loom.ts"),
    outDir: join(directory, "proof"),
    target: "node22",
    catalog: await store.listLooms(),
  });
  assert.ok(result.ok, JSON.stringify(result));
  const bad = consumer.replace('at:"/deliverable/a~1b"', 'at:"/missing"');
  await writeFile(join(directory, "author/loom.ts"), bad);
  const rejected = await compileLoom({
    entryFile: join(directory, "author/loom.ts"),
    outDir: join(directory, "bad"),
    catalog: await store.listLooms(),
    target: "node22",
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.diagnostics[0]?.code, "OUTCOME_CONTRACT_INVALID");
});

test("static installation, coexistence, immutability and failed-install atomic registration", async (t) => {
  const directory = await workspace(t);
  const artifact = await build(directory);
  const store = await createPackageStore({ dataDir: join(directory, "data") });
  t.after(() => store.close());
  const originalModule = await readFile(
    join(artifact.artifactDir, "runtime.mjs"),
  );
  // A valid re-indexed module that cannot be imported proves installation/query are static.
  const poison = new Map<string, Uint8Array>([
    [
      "package.json",
      await readFile(join(artifact.artifactDir, "package.json")),
    ],
    ["loom.json", await readFile(join(artifact.artifactDir, "loom.json"))],
    ["runtime.mjs", Buffer.from('throw new Error("MODULE_IMPORTED");')],
  ]);
  await writeFile(
    join(artifact.artifactDir, "runtime.mjs"),
    Buffer.from('throw new Error("MODULE_IMPORTED");'),
  );
  await writeFile(
    join(artifact.artifactDir, "integrity.json"),
    stableJson(await createIntegrity(poison)),
  );
  const archive = await packLoom({
    artifactDir: artifact.artifactDir,
    outFile: join(directory, "static.tgz"),
    dependencySources: [join(directory, "absent-unrelated")],
  });
  assert.deepEqual(
    (await inspectLoomPackage(archive.archiveFile)).root.artifactDigest,
    archive.root.artifactDigest,
  );
  const ref = await store.installLoom({ source: artifact.artifactDir });
  assert.equal(
    (await store.getLoom(ref)).ref.artifactDigest,
    ref.artifactDigest,
  );
  const rebuilt = await build(directory);
  const second = await store.installLoom({ source: rebuilt.artifactDir });
  assert.notEqual(ref.artifactDigest, second.artifactDigest);
  assert.equal((await store.listLooms()).length, 2);
  await assert.rejects(
    store.getLoom({ id: ref.id, version: ref.version }),
    hasCode("LOOM_AMBIGUOUS"),
  );
  await writeFile(join(rebuilt.artifactDir, "runtime.mjs"), "damaged");
  await assert.rejects(
    store.installLoom({ source: rebuilt.artifactDir }),
    hasCode("INTEGRITY_MISMATCH"),
  );
  assert.deepEqual(
    await readFile(
      join((await store.getLoom(second)).artifactDir, "runtime.mjs"),
    ),
    originalModule,
  );
  assert.equal((await store.listLooms()).length, 2);
  await store.close();
  const reopened = await createPackageStore({
    dataDir: join(directory, "data"),
  });
  t.after(() => reopened.close());
  assert.equal((await reopened.listLooms()).length, 2);
});

test("directory ownership excludes another process and is released after abrupt exit", async (t) => {
  const directory = await workspace(t);
  const module = pathToFileURL(
    join(root, "packages/kernel/dist/index.js"),
  ).href;
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const {createPackageStore}=await import(${JSON.stringify(module)}); await createPackageStore({dataDir:${JSON.stringify(join(directory, "data"))}}); console.log("ready"); setInterval(()=>{},1000);`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => {
    child.kill("SIGKILL");
  });
  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  await Promise.race([
    once(child.stdout, "data"),
    once(child, "exit").then(() => {
      throw new Error(stderr);
    }),
  ]);
  await assert.rejects(
    createPackageStore({ dataDir: join(directory, "data") }),
    hasCode("DATA_DIR_IN_USE"),
  );
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
  const store = await createPackageStore({ dataDir: join(directory, "data") });
  await store.close();
});

test("dependency preflight only reads the exported Loom literal and never imports author modules", async (t) => {
  const dir = await workspace(t);
  const projectDir = join(dir, "author");
  const entry = join(projectDir, "loom.ts");
  const catalog: never[] = [];
  const write = (properties: string) =>
    writeFile(
      entry,
      `import {defineLoom as loom} from "@intloom/loom-sdk"; import "./missing-generated-file.ts";
    throw Error("AUTHOR_EXECUTED");
    const unused = {dependencies:{ignored:{id:"wrong",version:"*"}}};
    export default loom({id:"parent",version:"1.0.0",description:"Parent",${properties},entry:unfinished});`,
    );
  await write(
    'dependencies: {"review-step":{id:"@example/review", version:"^1.0.0"}}',
  );
  await assert.rejects(
    resolveLoomDependencies({ projectDir, catalog }),
    hasCode("DEPENDENCY_MISSING"),
  );
  for (const declaration of [
    "dependencies",
    "dependencies: getDeps()",
    "dependencies: {...unused}",
    "dependencies: {child: external}",
    'dependencies: {child:{id:"child",version:process.env.VERSION}}',
    'dependencies:{child:{id:"child",versionRange:"*"}}',
    'dependencies: {["child"]:{id:"child",version:"*"}}',
    'dependencies:{child:{id:"one",version:"*"},child:{id:"two",version:"*"}}',
  ]) {
    await write(declaration);
    const result = await compileLoom({
      entryFile: entry,
      outDir: join(dir, "out"),
      target: "node22",
      catalog: () => {
        throw Error("CATALOG_ACCESSED");
      },
    });
    assert.equal(result.ok, false);
    assert.equal(
      result.diagnostics[0]?.code,
      "DEPENDENCY_DECLARATION_INVALID",
      declaration,
    );
    assert.equal(result.diagnostics[0]?.stage, "dependencies");
  }
  await write('dependencies:{child:{id:"child",version:"not-a-range"}}');
  await assert.rejects(
    resolveLoomDependencies({ projectDir, catalog }),
    hasCode("DEPENDENCY_RANGE_INVALID"),
  );
  await write("dependencies:{}");
  await writeFile(
    join(projectDir, "loom.dependencies.ts"),
    'throw Error("LEGACY_EXECUTED");',
  );
  await assert.rejects(
    resolveLoomDependencies({ projectDir, catalog }),
    /Move loom.dependencies.ts/,
  );
});

test("locks exact dependencies, generates checked I/N/O types, and shares a complete transitive graph", async (t) => {
  const directory = await workspace(t);
  const child = await build(directory);
  const store = await createPackageStore({ dataDir: join(directory, "data") });
  t.after(() => store.close());
  const childRef = await store.installLoom({ source: child.artifactDir });
  const parentDir = join(directory, "parent");
  await mkdir(parentDir);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(parentDir, "node_modules"),
  );
  const parentSource = `import {defineLoom,defineStep,defineWorkflow,type InputOf,type NormalizedInputOf,type OutputOf} from "@intloom/loom-sdk"; import {z} from "zod"; import {child} from "./.intloom/dependencies.ts";
    const raw: InputOf<typeof child> = {};
    const normalized: NormalizedInputOf<typeof child> = {count:3};
    // @ts-expect-error normalization requires the defaulted count
    const missing: NormalizedInputOf<typeof child> = {};
    // @ts-expect-error child output is an object with a numeric count
    const wrong: OutputOf<typeof child> = {count:"bad"};
    export default defineLoom({id:"parent",dependencies:{child:{id:"simple",version:"^1.0.0"}},version:"1.0.0",description:"Parent",entry:defineWorkflow({id:"flow",inputSchema:z.strictObject({}),outputSchema:z.strictObject({count:z.number()})}).then(defineStep(child,{id:"call"})).commit()});`;
  const parentEntry = join(parentDir, "loom.ts");
  await writeFile(parentEntry, parentSource);
  const dependencies = await resolveLoomDependencies({
    projectDir: parentDir,
    catalog: await store.listLooms(),
  });
  assert.equal(
    dependencies.lock.dependencies.child?.artifactDigest,
    childRef.artifactDigest,
  );
  const cyclicCatalog = (await store.listLooms()).map((entry) => ({
    ...entry,
    manifest: { ...entry.manifest, dependencies: { self: entry.ref } },
  }));
  await assert.rejects(
    resolveLoomDependencies({ projectDir: parentDir, catalog: cyclicCatalog }),
    hasCode("DEPENDENCY_CYCLE"),
  );
  await writeFixturePackage(parentEntry);
  const parent = await compileLoom({
    entryFile: parentEntry,
    outDir: join(directory, "parent-output"),
    target: "node22",
    dependencies,
  });
  assert.ok(parent.ok, JSON.stringify(parent));
  assert.deepEqual(parent.manifest.dependencies.child, childRef);
  await writeFile(
    parentEntry,
    parentSource.replace(
      ".then(defineStep(child",
      '.map(()=>({count:"bad"})).then(defineStep(child',
    ),
  );
  const mismatch = await compileLoom({
    entryFile: parentEntry,
    outDir: parent.artifactDir,
    target: "node22",
    dependencies,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.diagnostics[0]?.code, "TYPECHECK_FAILED");
  await writeFile(parentEntry, parentSource);
  const parentRef = await store.installLoom({ source: parent.artifactDir });
  const emptyStore = await createPackageStore({
    dataDir: join(directory, "recipient"),
  });
  t.after(() => emptyStore.close());
  await assert.rejects(
    emptyStore.installLoom({ source: parent.artifactDir }),
    hasCode("DEPENDENCY_MISSING"),
  );
  assert.equal((await emptyStore.listLooms()).length, 0);
  const installedParent = await store.getLoom(parentRef);
  const installedChild = await store.getLoom(childRef);
  const grandDir = join(directory, "grand");
  await mkdir(grandDir);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(grandDir, "node_modules"),
  );
  await writeFile(
    join(grandDir, "loom.ts"),
    'import {defineLoom,defineStep,defineWorkflow} from "@intloom/loom-sdk"; import {z} from "zod"; import {parent} from "./.intloom/dependencies.ts"; export default defineLoom({id:"grand",dependencies:{parent:{id:"parent",version:"1.0.0"}},version:"1.0.0",description:"Grand",entry:defineWorkflow({id:"grand",inputSchema:z.strictObject({}),outputSchema:z.strictObject({count:z.number()})}).then(defineStep(parent,{id:"parent"})).commit()});',
  );
  await writeFixturePackage(join(grandDir, "loom.ts"));
  const grand = await compileLoom({
    entryFile: join(grandDir, "loom.ts"),
    outDir: join(directory, "grand-output"),
    target: "node22",
    catalog: await store.listLooms(),
  });
  assert.ok(grand.ok, JSON.stringify(grand));
  const outFile = join(directory, "complete.tgz");
  await assert.rejects(
    packLoom({
      artifactDir: grand.artifactDir,
      outFile,
      dependencySources: [installedParent.artifactDir],
    }),
    hasCode("DEPENDENCY_MISSING"),
  );
  const packed = await packLoom({
    artifactDir: grand.artifactDir,
    outFile,
    dependencySources: [
      {
        ref: { ...installedChild.ref, artifactDigest: "0".repeat(64) },
        artifactDir: join(directory, "unrelated-missing"),
      },
      installedParent.artifactDir,
      installedChild.artifactDir,
      installedChild.artifactDir,
    ],
  });
  await assert.rejects(
    packLoom({
      artifactDir: grand.artifactDir,
      outFile,
      dependencySources: [
        installedParent,
        { ref: installedChild.ref, artifactDir: installedParent.artifactDir },
      ],
    }),
    hasCode("INTEGRITY_MISMATCH"),
  );
  const installed = await emptyStore.installLoom({
    source: packed.archiveFile,
  });
  assert.deepEqual(installed, packed.root);
  assert.equal((await emptyStore.listLooms()).length, 3);
  assert.equal(
    (
      await resolveLoomDependencies({
        projectDir: parentDir,
        catalog: await emptyStore.listLooms(),
      })
    ).lock.dependencies.child?.artifactDigest,
    childRef.artifactDigest,
  );
  const childSource = await readFile(join(directory, "author/loom.ts"), "utf8");
  const newer = await build(
    directory,
    childSource.replace('version: "1.0.0"', 'version: "1.1.0"'),
  );
  const newerRef = await store.installLoom({ source: newer.artifactDir });
  const kept = await resolveLoomDependencies({
    projectDir: parentDir,
    catalog: await store.listLooms(),
  });
  assert.equal(
    kept.lock.dependencies.child?.artifactDigest,
    childRef.artifactDigest,
  );
  const updated = await resolveLoomDependencies({
    projectDir: parentDir,
    catalog: await store.listLooms(),
    update: true,
  });
  assert.equal(
    updated.lock.dependencies.child?.artifactDigest,
    newerRef.artifactDigest,
  );
  const stale = await compileLoom({
    entryFile: parentEntry,
    outDir: parent.artifactDir,
    target: "node22",
    dependencies,
  });
  assert.equal(stale.ok, false);
  const variant = await build(
    directory,
    childSource
      .replace('version: "1.0.0"', 'version: "1.1.0"')
      .replace("Simple capability", "Variant"),
  );
  await store.installLoom({ source: variant.artifactDir });
  await assert.rejects(
    resolveLoomDependencies({
      projectDir: parentDir,
      catalog: await store.listLooms(),
      update: true,
    }),
    hasCode("DEPENDENCY_AMBIGUOUS"),
  );
  const selected = await resolveLoomDependencies({
    projectDir: parentDir,
    catalog: await store.listLooms(),
    update: true,
    selections: { child: newerRef.artifactDigest },
  });
  assert.equal(
    selected.lock.dependencies.child?.artifactDigest,
    newerRef.artifactDigest,
  );
  await writeFile(parentEntry, parentSource.replace("^1.0.0", "^2.0.0"));
  await assert.rejects(
    resolveLoomDependencies({
      projectDir: parentDir,
      catalog: await store.listLooms(),
    }),
    hasCode("LOCK_OUTDATED"),
  );
  await writeFile(
    parentEntry,
    childSource.replace('id: "simple"', 'id: "parent"'),
  );
  const removed = await compileLoom({
    entryFile: parentEntry,
    outDir: parent.artifactDir,
    target: "node22",
  });
  assert.equal(removed.diagnostics[0]?.code, "LOCK_OUTDATED");
  const empty = await compileLoom({
    entryFile: parentEntry,
    outDir: parent.artifactDir,
    target: "node22",
    update: true,
    catalog: async () => {
      throw Error("empty graph requested catalog");
    },
  });
  assert.ok(empty.ok, JSON.stringify(empty));
  assert.deepEqual(empty.manifest.dependencies, {});
  assert.deepEqual(
    JSON.parse(await readFile(dependencies.lockFile, "utf8")).dependencies,
    {},
  );
  assert.doesNotMatch(
    await readFile(dependencies.referencesFile, "utf8"),
    / as "child"/,
  );
});

test("archive and directory input reject path traversal, links and duplicate entries before registration", async (t) => {
  const directory = await workspace(t);
  const artifact = await build(directory);
  const store = await createPackageStore({ dataDir: join(directory, "data") });
  t.after(() => store.close());
  const good = await store.installLoom({ source: artifact.artifactDir });
  const archive = join(directory, "bad.tgz");
  for (const [name, type, duplicate] of [
    ["../escaped", "0", false],
    ["/escaped", "0", false],
    ["C:/escaped", "0", false],
    ["package/link", "2", false],
    ["package/hard", "1", false],
    ["package/loom.json", "0", true],
  ] as const) {
    const header = Buffer.alloc(512);
    header.write(name);
    header.write("0000644\0", 100);
    header.write("0000000\0", 108);
    header.write("0000000\0", 116);
    header.write("00000000000\0", 124);
    header.write("00000000000\0", 136);
    header.fill(32, 148, 156);
    header.write(type, 156);
    header.write("ustar\0", 257);
    header.write("00", 263);
    if (type === "1" || type === "2") header.write("../outside", 157);
    const sum = header.reduce((sum, value) => sum + value, 0);
    header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
    await writeFile(
      archive,
      gzipSync(
        Buffer.concat([
          header,
          ...(duplicate ? [header] : []),
          Buffer.alloc(1024),
        ]),
      ),
    );
    await assert.rejects(
      store.installLoom({ source: archive }),
      hasCode("PACKAGE_PATH_INVALID"),
    );
  }
  await symlink(
    join(artifact.artifactDir, "loom.json"),
    join(artifact.artifactDir, "link"),
  );
  await assert.rejects(
    store.installLoom({ source: artifact.artifactDir }),
    hasCode("PACKAGE_PATH_INVALID"),
  );
  assert.equal((await store.listLooms()).length, 1);
  assert.deepEqual((await store.getLoom(good)).ref, good);
});
