import assert from "node:assert/strict";
import { appendFile, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const [packageFile, directory, phase] = process.argv.slice(2);
const adapter = createRequire(packageFile);
const load = (id) => import(pathToFileURL(adapter.resolve(id)).href);
const { createWorkflow, createStep } = await load("@mastra/core/workflows");
const { Mastra } = await load("@mastra/core/mastra");
const { LibSQLStore } = await load("@mastra/libsql");
const { z } = await load("zod");
const effects = join(directory, "effects.txt");
const before = createStep({
  id: "before",
  inputSchema: z.number(),
  outputSchema: z.number(),
  retries: 0,
  execute: async ({ inputData }) => {
    await appendFile(effects, "once\n");
    return inputData + 1;
  },
});
const wait = createStep({
  id: "wait",
  inputSchema: z.number(),
  outputSchema: z.number(),
  resumeSchema: z.boolean(),
  suspendSchema: z.object({ question: z.string() }),
  retries: 0,
  execute: async ({ inputData, resumeData, suspend }) => {
    if (resumeData === undefined) return suspend({ question: "continue?" });
    return resumeData ? inputData * 2 : inputData;
  },
});
const workflow = createWorkflow({
  id: "wait-probe",
  inputSchema: z.number(),
  outputSchema: z.number(),
  options: { validateInputs: false, autoRestartActiveRuns: false },
  retryConfig: { attempts: 0, delay: 0 },
})
  .then(before)
  .then(wait)
  .commit();
const mastra = new Mastra({
  workflows: { workflow },
  logger: false,
  storage: new LibSQLStore({
    id: "wait-probe",
    url: pathToFileURL(join(directory, "native.db")).href,
  }),
});
try {
  if (phase === "create") {
    const run = await workflow.createRun({ runId: "native-wait" });
    const result = await run.start({ inputData: 3 });
    assert.equal(result.status, "suspended");
    assert.deepEqual(result.suspended, [["wait"]]);
  } else {
    const snapshot = await workflow.getWorkflowRunById("native-wait");
    assert.equal(snapshot.status, "suspended");
    assert.equal(await readFile(effects, "utf8"), "once\n");
    if (phase === "resume") {
      const run = await workflow.createRun({ runId: "native-wait" });
      const result = await run.resume({ step: "wait", resumeData: true });
      assert.equal(result.status, "success");
      assert.equal(result.result, 8);
      assert.equal(await readFile(effects, "utf8"), "once\n");
    }
  }
} finally {
  await mastra.shutdown();
}
console.log(`native-wait: ${phase} verified`);
