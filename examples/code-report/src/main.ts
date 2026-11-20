import type { LoomEntry } from "@intloom/loom-sdk";

const main: LoomEntry = async (input, context) => {
  await context.fs.write({
    path: `${context.workDir}/summary.md`,
    content: `# Report\n\n${input.prompt ?? ""}\n`,
  });
};

export default main;
