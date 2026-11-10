import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileLoom, packLoom } from "@intloom/compiler";
import { createPackageStore } from "@intloom/kernel";

await mkdir("author");
await writeFile(
  "author/package.json",
  JSON.stringify({ name: "consumer", type: "module" }),
);
await writeFile("author/guide.md", "An independently delivered resource.");
await writeFile(
  "author/legacy.cjs",
  'exports.id = () => require("node:path").basename("/code");',
);
await writeFile("author/legacy.d.cts", "export function id(): string;");
await writeFile(
  "author/loom.ts",
  `import {defineCode,defineLoom,resource,withDefault} from "@intloom/loom-sdk"; import {z} from "zod"; import {id} from "./legacy.cjs";
  const guide = resource({id:"guide",path:"guide.md"});
  export default defineLoom({id:"consumer",version:"1.0.0",description:"Real npm consumer",entry:defineCode({id:id(),inputSchema:z.strictObject({count:withDefault(z.number(),2)}),outputSchema:z.number(),uses:{resources:[guide]},execute:()=>{throw new Error("BUSINESS_EXECUTED");}})});`,
);
const child = await compileLoom({
  entryFile: "author/loom.ts",
  outDir: "compiled",
  target: "node22",
});
assert.ok(child.ok, JSON.stringify(child));
const source = await createPackageStore({ dataDir: "source-store" });
const childRef = await source.installLoom({ source: child.artifactDir });
await mkdir("parent");
await writeFile(
  "parent/package.json",
  JSON.stringify({ name: "parent", type: "module" }),
);
await writeFile(
  "parent/loom.ts",
  `import {defineLoom,defineStep,defineWorkflow} from "@intloom/loom-sdk"; import {z} from "zod"; import {child} from "./.intloom/dependencies.ts";
  export default defineLoom({id:"parent",dependencies:{child:{id:"consumer",version:"^1.0.0"}},version:"1.0.0",description:"Parent",entry:defineWorkflow({id:"flow",inputSchema:z.strictObject({}),outputSchema:z.number()}).then(defineStep(child,{id:"call"})).commit()});`,
);
const parent = await compileLoom({
  entryFile: "parent/loom.ts",
  outDir: "parent-compiled",
  target: "node22",
  catalog: await source.listLooms(),
});
assert.ok(parent.ok, JSON.stringify(parent));
const packed = await packLoom({
  artifactDir: parent.artifactDir,
  dependencySources: [(await source.getLoom(childRef)).artifactDir],
  outFile: "shared.tgz",
});
await source.close();
const recipient = await createPackageStore({ dataDir: "recipient" });
const root = await recipient.installLoom({ source: packed.archiveFile });
assert.deepEqual(root, packed.root);
assert.equal((await recipient.listLooms()).length, 2);
const installed = await recipient.getLoom(childRef);
assert.equal(
  await readFile(
    resolve(installed.artifactDir, installed.manifest.resources.guide.path),
    "utf8",
  ),
  "An independently delivered resource.",
);
await cp(installed.artifactDir, "standalone", { recursive: true });
await recipient.close();
for (const path of [
  "author",
  "parent",
  "compiled",
  "parent-compiled",
  "source-store",
  "recipient",
])
  await rm(path, { recursive: true });
// Hide even the consumer's installed SDK/Schema libraries during the plain Node load.
const { rename } = await import("node:fs/promises");
await rename("node_modules", "hidden-dependencies");
try {
  const result = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const loom=(await import(${JSON.stringify(pathToFileURL(resolve("standalone/runtime.mjs")).href)})).default; console.log(JSON.stringify({id:loom.entry.id,input:loom.entry.inputSchema.parse({})}));`,
    ],
    { encoding: "utf8", cwd: resolve("standalone") },
  );
  assert.deepEqual(JSON.parse(result), { id: "code", input: { count: 2 } });
} finally {
  await rename("hidden-dependencies", "node_modules");
}
console.log(
  "compiler-consumer: tarball compiler, dependency types, complete archive, SQLite install, standalone Node load verified",
);
