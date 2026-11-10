import assert from "node:assert/strict";
import { mkdir, copyFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileLoom } from "@intloom/compiler";
import { serve } from "@intloom/kernel";
const author = resolve("execution-author");
await mkdir(author);
await writeFile(
  `${author}/package.json`,
  JSON.stringify({ name: "workflow-run", type: "module" }),
);
await copyFile("execution-workflow.ts", `${author}/loom.ts`);
const compiled = await compileLoom({
  entryFile: `${author}/loom.ts`,
  outDir: resolve("execution-artifact"),
  target: "node22",
});
assert.ok(compiled.ok, JSON.stringify(compiled));
await rm(author, { recursive: true });
const host = await serve({
  dataDir: resolve("execution-data"),
  bindings: {
    tools: {
      "workflow-run@1.0.0": {
        multiply: {
          implementation: "multiply",
          revision: "1",
          execute: ({ input }) => input * 3,
        },
      },
    },
  },
});
try {
  const loom = await host.installLoom({ source: compiled.artifactDir });
  const run = await host.createRun({ loom, input: undefined });
  await host.startRun(run.id);
  await host.close();
  const reader = await serve({ dataDir: resolve("execution-data") });
  try {
    const result = await reader.getRunResult(run.id);
    assert.equal(result.runStatus, "succeeded");
    assert.deepEqual(result.output, {
      value: 141,
      initial: 2,
      seed: 3,
      counts: { input: 1, boundOutput: 1 },
    });
  } finally {
    await reader.close();
  }
} finally {
  await host.close();
}
const qwenAuthor = resolve("execution-qwen-author");
await mkdir(qwenAuthor);
await writeFile(
  `${qwenAuthor}/package.json`,
  JSON.stringify({ name: "qwen-consumer", type: "module" }),
);
await writeFile(
  `${qwenAuthor}/loom.ts`,
  `import {defineAgent,defineLoom} from "@intloom/loom-sdk";import {z} from "zod";
export default defineLoom({id:"qwen-consumer",version:"1.0.0",description:"Qwen native schema",entry:defineAgent({id:"structured",inputSchema:z.string(),outputSchema:z.strictObject({value:z.literal(42)}),model:{slot:"model"},instructions:"Return the result",prompt:({inputData})=>inputData,outputMode:"structured"})});`,
);
const qwenCompiled = await compileLoom({
  entryFile: `${qwenAuthor}/loom.ts`,
  outDir: resolve("execution-qwen-artifact"),
  target: "node22",
});
assert.ok(qwenCompiled.ok, JSON.stringify(qwenCompiled));
await rm(qwenAuthor, { recursive: true });
await writeFile(
  "intloom.yaml",
  JSON.stringify({
    version: 1,
    models: {
      qwen: {
        provider: "alibaba",
        model: "qwen3.8-flash",
        credentialRef: "env:TEST_MODEL",
        options: { baseUrl: "https://fixture.invalid/v1", api: "chat" },
      },
    },
    profiles: { default: "qwen" },
  }),
);
const qwenHost = await serve({
  dataDir: resolve("execution-qwen-data"),
  bindings: {
    resolveCredential: () => "fixture-key",
  },
});
const originalFetch = globalThis.fetch;
let requests = 0;
globalThis.fetch = async (input, init) => {
  requests++;
  assert.equal(String(input), "https://fixture.invalid/v1/chat/completions");
  assert.equal(
    new Headers(init.headers).get("authorization"),
    "Bearer fixture-key",
  );
  const body = JSON.parse(init.body);
  assert.equal(body.model, "qwen3.8-flash");
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.strict, true);
  return Response.json({
    id: "fixture-completion",
    object: "chat.completion",
    created: 1,
    model: "qwen3.8-flash",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: '{"value":42}' },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
};
try {
  const loom = await qwenHost.installLoom({ source: qwenCompiled.artifactDir });
  const run = await qwenHost.createRun(
    { loom, input: "Return value 42" },
    process.cwd(),
  );
  await qwenHost.startRun(run.id);
  await qwenHost.close();
  const reader = await serve({ dataDir: resolve("execution-qwen-data") });
  try {
    const result = await reader.getRunResult(run.id);
    assert.equal(result.runStatus, "succeeded");
    assert.deepEqual(result.output, { value: 42 });
    assert.equal(requests, 1);
  } finally {
    await reader.close();
  }
} finally {
  await qwenHost.close();
  globalThis.fetch = originalFetch;
}
console.log(
  "execution-consumer: packaged Workflow constructs, Qwen native schema, tool bindings, single validation and persistence verified",
);
